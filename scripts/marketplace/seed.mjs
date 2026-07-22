/**
 * Seed the 6 launch verticals + categories (spec §2, decisions §12).
 * Idempotent: verticals/categories are upserted by slug; re-running updates
 * names/schemas but never deletes.
 *
 * Usage: TURSO_DATABASE_URL=... [TURSO_AUTH_TOKEN=...] node scripts/marketplace/seed.mjs
 */
import { createClient } from "@libsql/client";

const VERTICALS = [
  {
    slug: "garages",
    name_en: "Garages",
    name_fr: "Garages",
    sort: 1,
    attribute_schema: {
      fields: [
        { key: "brands", label: "Brands serviced", type: "text" },
        { key: "loaner_car", label: "Loaner car available", type: "boolean" },
      ],
    },
    categories: [
      { slug: "oil-change", name_en: "Oil change", name_fr: "Vidange" },
      { slug: "tyres", name_en: "Tyres", name_fr: "Pneus" },
      { slug: "brakes", name_en: "Brakes", name_fr: "Freins" },
      { slug: "inspection-prep", name_en: "Inspection prep", name_fr: "Préparation contrôle technique" },
      { slug: "bodywork", name_en: "Bodywork", name_fr: "Carrosserie" },
    ],
  },
  {
    slug: "artisans",
    name_en: "Tradespeople",
    name_fr: "Artisans",
    sort: 2,
    attribute_schema: {
      fields: [
        { key: "emergency_24_7", label: "24/7 emergency", type: "boolean" },
        {
          key: "hourly_rate_band",
          label: "Hourly rate band",
          type: "select",
          options: ["< €50", "€50–75", "€75–100", "> €100"],
        },
      ],
    },
    categories: [
      { slug: "plumber", name_en: "Plumber", name_fr: "Plombier" },
      { slug: "electrician", name_en: "Electrician", name_fr: "Électricien" },
      { slug: "painter", name_en: "Painter", name_fr: "Peintre" },
      { slug: "heating", name_en: "Heating", name_fr: "Chauffage" },
      { slug: "roofer", name_en: "Roofer", name_fr: "Couvreur" },
      { slug: "locksmith", name_en: "Locksmith", name_fr: "Serrurier" },
    ],
  },
  {
    slug: "cleaning",
    name_en: "Cleaning",
    name_fr: "Nettoyage",
    sort: 3,
    attribute_schema: {
      fields: [
        { key: "recurring", label: "Recurring service available", type: "boolean" },
        { key: "eco_products", label: "Eco products", type: "boolean" },
      ],
    },
    categories: [
      { slug: "home-cleaning", name_en: "Home cleaning", name_fr: "Nettoyage à domicile" },
      { slug: "office-cleaning", name_en: "Office cleaning", name_fr: "Nettoyage de bureaux" },
      { slug: "end-of-lease", name_en: "End-of-lease cleaning", name_fr: "Nettoyage fin de bail" },
    ],
  },
  {
    slug: "demenagement",
    name_en: "Moving",
    name_fr: "Déménagement",
    sort: 4,
    attribute_schema: {
      fields: [
        { key: "lift_rental", label: "Furniture lift", type: "boolean" },
        { key: "packing_service", label: "Packing service", type: "boolean" },
      ],
    },
    categories: [
      { slug: "local-move", name_en: "Local move", name_fr: "Déménagement local" },
      { slug: "international-move", name_en: "International move", name_fr: "Déménagement international" },
      { slug: "storage", name_en: "Storage", name_fr: "Garde-meuble" },
    ],
  },
  {
    slug: "coiffeur",
    name_en: "Hairdressers",
    name_fr: "Coiffeurs",
    sort: 5,
    attribute_schema: {
      fields: [{ key: "walk_ins", label: "Walk-ins accepted", type: "boolean" }],
    },
    categories: [
      { slug: "men-cut", name_en: "Men's cut", name_fr: "Coupe homme" },
      { slug: "women-cut", name_en: "Women's cut", name_fr: "Coupe femme" },
      { slug: "coloring", name_en: "Coloring", name_fr: "Coloration" },
      { slug: "barber", name_en: "Barber", name_fr: "Barbier" },
    ],
  },
  {
    slug: "beaute",
    name_en: "Beauty",
    name_fr: "Beauté",
    sort: 6,
    attribute_schema: {
      fields: [{ key: "home_service", label: "At-home service", type: "boolean" }],
    },
    categories: [
      { slug: "esthetician", name_en: "Esthetician", name_fr: "Esthéticienne" },
      { slug: "nails", name_en: "Nails", name_fr: "Ongles" },
      { slug: "massage", name_en: "Massage", name_fr: "Massage" },
      { slug: "spa", name_en: "Spa", name_fr: "Spa" },
    ],
  },
];

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

for (const v of VERTICALS) {
  await db.execute({
    sql: `INSERT INTO verticals (slug, name_en, name_fr, attribute_schema, booking_enabled, active, sort)
          VALUES (?, ?, ?, ?, 1, 1, ?)
          ON CONFLICT(slug) DO UPDATE SET
            name_en = excluded.name_en,
            name_fr = excluded.name_fr,
            attribute_schema = excluded.attribute_schema,
            sort = excluded.sort`,
    args: [v.slug, v.name_en, v.name_fr, JSON.stringify(v.attribute_schema), v.sort],
  });
  const row = await db.execute({
    sql: "SELECT id FROM verticals WHERE slug = ?",
    args: [v.slug],
  });
  const verticalId = row.rows[0].id;

  for (const c of v.categories) {
    await db.execute({
      sql: `INSERT INTO categories (vertical_id, slug, name_en, name_fr)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(vertical_id, slug) DO UPDATE SET
              name_en = excluded.name_en,
              name_fr = excluded.name_fr`,
      args: [verticalId, c.slug, c.name_en, c.name_fr],
    });
  }
}

const counts = await db.execute({
  sql: `SELECT (SELECT COUNT(*) FROM verticals) AS verticals,
               (SELECT COUNT(*) FROM categories) AS categories`,
  args: [],
});
console.log(
  `Seeded: ${counts.rows[0].verticals} verticals, ${counts.rows[0].categories} categories`
);
db.close();
