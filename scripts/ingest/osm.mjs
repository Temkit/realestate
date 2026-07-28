/**
 * Seed the marketplace directory from OpenStreetMap (Overpass API).
 *
 * OSM data is ODbL-licensed (free, storable, attribution required). We import
 * businesses as `status='draft'` providers for admin review, tagged
 * source='osm' + source_ref='osm:<type>/<id>' for dedup + later refresh.
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./local.db node scripts/ingest/osm.mjs
 *   DRY_RUN=1 TURSO_DATABASE_URL=... node scripts/ingest/osm.mjs   # no writes
 *   LIMIT=20 ...                                                    # cap per mapping
 *
 * Attribution: data © OpenStreetMap contributors (ODbL).
 */
import { createClient } from "@libsql/client";

// Luxembourg bounding box (S, W, N, E)
const BBOX = "49.44,5.73,50.19,6.53";
// Public Overpass mirrors — tried in order with backoff. Public instances are
// frequently overloaded (504) or rate-limited (429); more mirrors = more luck.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/**
 * OSM selectors → our vertical + categories.
 * categories: 'all' links every active category of the vertical (a general
 * business, e.g. a full-service garage); otherwise the listed category slugs.
 */
const MAPPINGS = [
  { label: "Garages", vertical: "garages", categories: "all", selectors: [["shop", "car_repair"]] },
  { label: "Tyre shops", vertical: "garages", categories: ["tyres"], selectors: [["shop", "tyres"]] },
  { label: "Bodywork", vertical: "garages", categories: ["bodywork"], selectors: [["shop", "car_repair"], ["craft", "car_repair"]] },
  { label: "Plumbers", vertical: "artisans", categories: ["plumber"], selectors: [["craft", "plumber"]] },
  { label: "Electricians", vertical: "artisans", categories: ["electrician"], selectors: [["craft", "electrician"]] },
  { label: "Painters", vertical: "artisans", categories: ["painter"], selectors: [["craft", "painter"]] },
  { label: "Roofers", vertical: "artisans", categories: ["roofer"], selectors: [["craft", "roofer"]] },
  { label: "Heating/HVAC", vertical: "artisans", categories: ["heating"], selectors: [["craft", "hvac"]] },
  { label: "Locksmiths", vertical: "artisans", categories: ["locksmith"], selectors: [["craft", "locksmith"], ["shop", "locksmith"]] },
  { label: "Hairdressers", vertical: "coiffeur", categories: ["men-cut", "women-cut", "coloring"], selectors: [["shop", "hairdresser"]] },
  { label: "Beauty salons", vertical: "beaute", categories: ["esthetician"], selectors: [["shop", "beauty"]] },
  { label: "Nails", vertical: "beaute", categories: ["nails"], selectors: [["shop", "nails"]] },
  { label: "Massage", vertical: "beaute", categories: ["massage"], selectors: [["shop", "massage"]] },
  { label: "Spa", vertical: "beaute", categories: ["spa"], selectors: [["leisure", "spa"]] },
];
// Note: cleaning + déménagement are poorly covered in OSM — seeded via other
// sources (Chambre des Métiers / Editus) later, not here.

const DRY = process.env.DRY_RUN === "1";
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
// 'draft' (default, needs admin publish) or 'listed' (public directory now).
const IMPORT_STATUS = process.env.IMPORT_STATUS === "listed" ? "listed" : "draft";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
function normPhone(p) {
  return p ? p.replace(/[^\d]/g, "") : "";
}

function buildQuery(selectors) {
  const lines = selectors
    .map(([k, v]) => `  node["${k}"="${v}"](${BBOX});\n  way["${k}"="${v}"](${BBOX});`)
    .join("\n");
  return `[out:json][timeout:90];\n(\n${lines}\n);\nout center tags;`;
}

// Overpass requires a descriptive User-Agent and can rate-limit (429);
// retry across endpoints with backoff.
const UA = "lux24-directory-ingest/1.0 (+https://lux24.lu; contact@lux24.lu)";

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
            Accept: "application/json",
          },
          body: "data=" + encodeURIComponent(query),
        });
        if (res.status === 429) throw new Error("HTTP 429 (rate limited)");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.elements || [];
      } catch (e) {
        lastErr = e;
        console.warn(`  overpass ${endpoint} failed: ${e.message}`);
        await sleep(5000); // back off before the next endpoint/attempt
      }
    }
  }
  throw lastErr;
}

// Load vertical → { catSlug: id } from the DB
async function loadCategories() {
  const res = await db.execute({
    sql: `SELECT v.slug AS vslug, c.slug AS cslug, c.id AS cid
          FROM categories c JOIN verticals v ON v.id = c.vertical_id WHERE c.active = 1`,
    args: [],
  });
  const map = {};
  for (const r of res.rows) {
    (map[r.vslug] ||= {})[r.cslug] = Number(r.cid);
  }
  return map;
}

async function uniqueSlug(base) {
  let slug = base || "provider";
  let n = 1;
  while (true) {
    const candidate = n === 1 ? slug : `${slug}-${n}`;
    const r = await db.execute({ sql: "SELECT 1 FROM providers WHERE slug = ? LIMIT 1", args: [candidate] });
    if (r.rows.length === 0) return candidate;
    n++;
  }
}

async function run() {
  const catMap = await loadCategories();

  // Preload existing keys for dedup (source_ref + phone)
  const existing = await db.execute({ sql: "SELECT source_ref, phone FROM providers", args: [] });
  const seenRefs = new Set();
  const seenPhones = new Set();
  for (const r of existing.rows) {
    if (r.source_ref) seenRefs.add(String(r.source_ref));
    const np = normPhone(r.phone);
    if (np.length >= 6) seenPhones.add(np);
  }

  let totalInserted = 0,
    totalSkipped = 0,
    totalNoName = 0;

  for (const m of MAPPINGS) {
    const cats =
      m.categories === "all"
        ? Object.values(catMap[m.vertical] || {})
        : m.categories.map((s) => catMap[m.vertical]?.[s]).filter(Boolean);
    if (cats.length === 0) {
      console.log(`- ${m.label}: no categories resolved for vertical '${m.vertical}', skipping`);
      continue;
    }

    await sleep(3000); // pace requests to stay under Overpass rate limits
    process.stdout.write(`- ${m.label} … `);
    let elements;
    try {
      elements = await overpass(buildQuery(m.selectors));
    } catch (e) {
      console.log(`query failed (${e.message})`);
      continue;
    }

    let inserted = 0,
      skipped = 0,
      count = 0;
    for (const el of elements) {
      if (count >= LIMIT) break;
      const tags = el.tags || {};
      const name = (tags.name || "").trim();
      if (!name) {
        totalNoName++;
        continue;
      }
      count++;
      const ref = `osm:${el.type}/${el.id}`;
      const phone = tags.phone || tags["contact:phone"] || null;
      const np = normPhone(phone);

      // Dedup: same OSM object, or same phone as an existing provider
      if (seenRefs.has(ref) || (np.length >= 6 && seenPhones.has(np))) {
        skipped++;
        totalSkipped++;
        continue;
      }
      seenRefs.add(ref);
      if (np.length >= 6) seenPhones.add(np);

      const website = tags.website || tags["contact:website"] || null;
      const email = tags.email || tags["contact:email"] || "";
      const hn = tags["addr:housenumber"];
      const street = tags["addr:street"];
      const city = tags["addr:city"] || tags["addr:place"] || null;
      const address = [hn && street ? `${hn} ${street}` : street, tags["addr:postcode"], city]
        .filter(Boolean)
        .join(", ") || null;
      const commune = city ? slugify(city) : null;

      if (DRY) {
        inserted++;
        continue;
      }

      const slug = await uniqueSlug(slugify(name) + (commune ? `-${commune}` : ""));
      let providerId;
      try {
        const res = await db.execute({
          sql: `INSERT INTO providers (slug, name, email, phone, website, address, commune,
                  status, plan, source, source_ref, sales_rep)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'free', 'osm', ?, 'import:osm')
                RETURNING id`,
          args: [slug, name, email, phone, website, address, commune, IMPORT_STATUS, ref],
        });
        providerId = Number(res.rows[0].id);
      } catch (e) {
        skipped++;
        totalSkipped++;
        continue;
      }

      await db.batch(cats.map((cid) => ({
        sql: "INSERT OR IGNORE INTO provider_categories (provider_id, category_id) VALUES (?, ?)",
        args: [providerId, cid],
      })));
      if (commune) {
        await db.execute({
          sql: "INSERT OR IGNORE INTO provider_coverage (provider_id, commune_slug) VALUES (?, ?)",
          args: [providerId, commune],
        });
      }
      inserted++;
      totalInserted++;
    }
    console.log(`${elements.length} found, ${inserted} imported, ${skipped} skipped`);
    await sleep(2000); // Overpass courtesy delay
  }

  console.log(
    `\n${DRY ? "[DRY RUN] " : ""}Done. Imported ${totalInserted}, skipped ${totalSkipped} (dupes), ${totalNoName} without a name.`
  );
  console.log("Review the drafts in /admin/providers?status=draft and activate them.");
  db.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
