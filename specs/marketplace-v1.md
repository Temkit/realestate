# SPEC — olu.lu Marketplace v1 (provider-first, multi-vertical)

Status: DRAFT — awaiting owner sign-off
Date: 2026-07-19
Owner: Sid
Model: **Check24-style comparison + lead intermediary, supply built by a sales team** — no scraping for new verticals. Immo stays as-is (its own aggregation vertical).

---

## 1. Vision & business model

- Sales reps visit Luxembourg companies (garages, trades, cleaning, movers, …) and sign them up.
- Signed providers + their offers live in **our** database — the source of truth, not scraped.
- Public site shows comparison pages per `vertical × category × commune`, reusing the existing SEO factory.
- Users submit a **quote request / contact** → we fan it out to up to 3 matching providers → each dispatch is the billable event (CPL) or covered by a subscription tier.
- Launch free for providers (fill supply), flip to paid once leads flow.

**Non-goals for v1** (explicitly out):
- No scraping/feeds for new verticals.
- No provider self-service portal (ops enters data from the sales form).
- No online payments, no booking calendar, no reviews (all phase ≥3).
- No changes to the existing immo pipeline or its URLs.

---

## 2. Verticals (config-driven)

A vertical is a **row in the DB**, not code. Adding one = insert + translations, zero deploys.

Launch candidates (sales picks the final 2–3):

| Vertical slug | Categories (examples) | Lead type |
|---|---|---|
| `garages` | oil-change, tyres, brakes, inspection-prep, bodywork | quote / appointment request |
| `artisans` | plumber, electrician, painter, heating, roofer, locksmith | quote request |
| `cleaning` | home-cleaning, office-cleaning, end-of-lease | quote request |
| `demenagement` | local-move, international-move, storage | quote request |

Each vertical carries two JSON schemas (stored in the DB, validated in code):
- `attribute_schema` — what an **offer** can specify (e.g. garages: brands serviced, loaner car y/n; artisans: emergency 24/7 y/n, hourly rate band).
- `lead_form_schema` — extra questions the lead form asks (e.g. moving: m², floors, elevator y/n; garage: car make/model/year).

---

## 3. Data model (Turso / libsql)

Reuses the existing Turso instance. All prices in **cents**. All timestamps ISO-8601 UTC.

```sql
CREATE TABLE verticals (
  id               INTEGER PRIMARY KEY,
  slug             TEXT UNIQUE NOT NULL,     -- 'garages' — must not collide with mode slugs (buy|rent|acheter|louer)
  name_en          TEXT NOT NULL,
  name_fr          TEXT NOT NULL,
  attribute_schema TEXT NOT NULL DEFAULT '{}',  -- JSON, offer attributes
  lead_form_schema TEXT NOT NULL DEFAULT '{}',  -- JSON, extra lead questions
  active           INTEGER NOT NULL DEFAULT 1,
  sort             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  vertical_id INTEGER NOT NULL REFERENCES verticals(id),
  slug        TEXT NOT NULL,                -- 'plumber'
  name_en     TEXT NOT NULL,
  name_fr     TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  UNIQUE (vertical_id, slug)
);

CREATE TABLE providers (
  id          INTEGER PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,         -- 'garage-muller-esch'
  name        TEXT NOT NULL,
  vat_number  TEXT,                         -- LU VAT — dedup + future invoicing
  email       TEXT NOT NULL,                -- lead delivery channel
  phone       TEXT,
  whatsapp    TEXT,
  website     TEXT,
  address     TEXT,
  commune     TEXT,                         -- canonical slug from communes.ts
  logo_url    TEXT,
  photos      TEXT NOT NULL DEFAULT '[]',   -- JSON array of URLs
  description_en TEXT,
  description_fr TEXT,
  languages   TEXT NOT NULL DEFAULT '[]',   -- JSON, e.g. ["fr","lb","de","en","pt"]
  status      TEXT NOT NULL DEFAULT 'draft',-- draft | active | paused | churned
  plan        TEXT NOT NULL DEFAULT 'free', -- free | starter | pro (placement weight)
  cpl_cents   INTEGER,                      -- agreed price per lead; NULL = free period
  sales_rep   TEXT,                         -- who signed them
  signed_at   TEXT,
  notes       TEXT,                         -- internal, never rendered
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE TABLE provider_categories (
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY (provider_id, category_id)
);

CREATE TABLE provider_coverage (
  provider_id  INTEGER NOT NULL REFERENCES providers(id),
  commune_slug TEXT NOT NULL,               -- canonical slug; '*' = all of Luxembourg
  PRIMARY KEY (provider_id, commune_slug)
);

CREATE TABLE offers (
  id          INTEGER PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  title_en    TEXT NOT NULL,
  title_fr    TEXT NOT NULL,
  price_type  TEXT NOT NULL,                -- fixed | from | hourly | quote
  price_cents INTEGER,                      -- NULL when price_type = 'quote'
  attributes  TEXT NOT NULL DEFAULT '{}',   -- JSON, validated against verticals.attribute_schema
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE TABLE leads (
  id          TEXT PRIMARY KEY,             -- nanoid(12)
  vertical_id INTEGER NOT NULL REFERENCES verticals(id),
  category_id INTEGER REFERENCES categories(id),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,                         -- email OR phone required (app-level check)
  commune     TEXT,
  message     TEXT,
  answers     TEXT NOT NULL DEFAULT '{}',   -- JSON, per lead_form_schema
  locale      TEXT NOT NULL DEFAULT 'fr',
  source_page TEXT,                         -- path where the form was submitted
  status      TEXT NOT NULL DEFAULT 'new',  -- new | dispatched | answered | converted | invalid
  consent_at  TEXT NOT NULL,                -- GDPR consent timestamp (required)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One lead fans out to up to 3 providers. The dispatch is the billable unit.
CREATE TABLE lead_dispatches (
  id           INTEGER PRIMARY KEY,
  lead_id      TEXT NOT NULL REFERENCES leads(id),
  provider_id  INTEGER NOT NULL REFERENCES providers(id),
  channel      TEXT NOT NULL DEFAULT 'email', -- email | whatsapp (P2)
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | sent | bounced | answered | converted | disputed
  billable     INTEGER NOT NULL DEFAULT 0,
  billed_cents INTEGER,
  sent_at      TEXT,
  UNIQUE (lead_id, provider_id)
);

CREATE TABLE lead_events (                  -- audit trail, drives the admin timeline
  id          INTEGER PRIMARY KEY,
  lead_id     TEXT NOT NULL REFERENCES leads(id),
  dispatch_id INTEGER REFERENCES lead_dispatches(id),
  event       TEXT NOT NULL,                -- created | dispatched | bounced | provider_replied | marked_converted | disputed | invalidated
  actor       TEXT NOT NULL,                -- 'system' | 'admin' | 'provider'
  meta        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Indexes: `leads(status, created_at)`, `lead_dispatches(provider_id, status)`, `offers(category_id, active)`, `provider_coverage(commune_slug)`.

**GDPR (CNPD)**: consent checkbox mandatory on the lead form (`consent_at`); privacy page updated to name lead-forwarding to providers as the purpose; auto-purge cron anonymizes leads older than 12 months (QStash, alongside the existing warm-cache cron).

---

## 4. Matching & ranking

For a lead in `(category, commune)`:

1. Candidates = providers `status='active'` with that category AND (`commune` in coverage OR `'*'`).
2. If < 3, widen with `NEARBY_COMMUNES` from `src/lib/communes.ts` (already in repo).
3. Rank: plan weight (pro > starter > free) → fewest dispatches in last 7 days (fair rotation) → newest signup.
4. Take top 3, create dispatches, send.

Public listing pages use the same candidate query, ranked by plan weight then price (when comparable), with a "Sponsored" tag on paid placement — required for transparency.

---

## 5. Lead flow

```
form submit → POST /api/leads
  → validate (Zod, per-vertical lead_form_schema) + rate-limit (existing rate-limit.ts) + honeypot
  → insert lead (status=new, consent_at)
  → match (§4) → insert dispatches
  → send provider emails + user confirmation email
  → status=dispatched
```

- **Email**: Resend (new dependency — free tier 3k/mo, fits Vercel). Provider email contains lead details + two magic links: “I take this job” / “Not relevant” → `GET /api/leads/r/[token]` flips dispatch to `answered`/`disputed` — no portal, no login.
- Failure handling: email send failures leave dispatch `pending`; admin inbox shows them for manual retry. No silent drops.
- Billing v1 = **a monthly CSV export** per provider (billable dispatches × cpl_cents). Invoicing stays manual; no payment integration.

---

## 6. Admin back-office

Route group `/(admin)/admin/**`, excluded from sitemap, `X-Robots-Tag: noindex`.

- **Auth v1**: `ADMIN_PASSWORD` env + HMAC-signed httpOnly session cookie (8h). Single role. Upgrade path: proper auth when the provider portal arrives (P3).
- Pages:
  - `/admin/providers` — list/filter (status, vertical, sales_rep), create/edit form (mirrors the paper sales form 1:1), activate/pause.
  - `/admin/providers/[id]/offers` — offer CRUD, attribute fields rendered from `attribute_schema`.
  - `/admin/leads` — inbox: status filters, timeline from `lead_events`, manual re-dispatch, mark converted/invalid.
  - `/admin/config` — verticals + categories CRUD (guarded: slug collisions with mode slugs rejected).
  - `/admin/stats` — leads/day, dispatch answer rate, top communes/categories, per-provider counts, billing export button.

---

## 7. Public pages & routing

Current immo routes are `/[locale]/[mode]/[propertyType]/[commune]` (mode ∈ buy|rent|acheter|louer). Marketplace uses the **same 3-segment depth**: `/[locale]/[vertical]/[category]/[commune]`.

- Widen the resolver in `src/lib/seo/slugs.ts`: segment matches a mode slug → immo flow (unchanged, keeps all indexed URLs); segment matches an active vertical slug → marketplace flow. Reserved-slug check on vertical creation.
- New pages (all ISR, revalidate 1h — DB reads are cheap, no API costs):
  - `/[locale]/[vertical]` — vertical hub: categories + top communes.
  - `/[locale]/[vertical]/[category]` — country-wide category page.
  - `/[locale]/[vertical]/[category]/[commune]` — **the SEO money page**: provider cards, price table where comparable, lead form CTA. JSON-LD `LocalBusiness` + `Service` (reuse `src/lib/seo/json-ld.ts` patterns, breadcrumbs, internal links).
  - `/[locale]/pro/[provider-slug]` — provider profile + its offers + lead form.
- Homepage gains a vertical switcher (immo | garages | artisans | …). Conversational search (P2): the intent classifier gets a vertical-routing step; marketplace queries answer from SQL, not the scrape pipeline — strictly simpler than what exists.
- i18n: all new strings in `messages/en.json` + `fr.json`; category/vertical names come from DB columns.

---

## 8. Sales onboarding kit (what the reps collect)

One page, maps 1:1 to `providers` + `offers`:

1. Company name, VAT, address, commune
2. Contact for leads: email (required), phone, WhatsApp
3. Vertical + categories (checkboxes)
4. Coverage: communes served or "all Luxembourg"
5. 1–5 offers: title, price (fixed / from / hourly / on-quote)
6. Languages spoken, logo/photos (photo of their sign is fine), short description
7. Plan + agreed CPL (or "free launch period until <date>"), signature, date, rep name

Digital version: a Tally/Typeform → CSV import later; paper is fine for v1, ops types it in.

---

## 9. Monetization (defaults — owner to confirm)

- Launch: free until enough leads flow (target: provider has received ≥5 leads).
- Then either **CPL** (garages €10–20, artisans €15–25, moving €25–40, cleaning €10–15) or **subscription** (starter €49/mo — listed + leads; pro €99/mo — top placement + badge). Sales decides per provider; both fields exist in the schema.
- A dispatch is billable when status reaches `sent` and is not `disputed`/`invalid` within 72h.

---

## 10. Phases

| Phase | Scope | Effort |
|---|---|---|
| **P0** | Schema + migrations, seed 2 verticals + categories, admin auth + providers/offers/config CRUD | ~1 wk |
| **P1** | Public pages (hub/category/commune/profile), lead form + matching + Resend dispatch + magic-link replies, sitemap, GDPR purge cron | ~2 wk |
| **P2** | Admin stats + billing export, WhatsApp dispatch, conversational search over marketplace DB, homepage vertical switcher | ~1–2 wk |
| **P3** | Provider portal (self-service, real auth), reviews with moderation, online booking/calendar, payments | later |

**Definition of done P1**: a sales rep signs a real garage on paper → ops enters it in admin → its commune page ranks it → a test lead submitted on that page arrives in the garage's inbox with working magic links → dispatch visible in admin with full event timeline.

---

## 11. Open questions (need owner answers)

1. **Launch verticals** — which 2–3 does sales attack first? (spec assumes garages + artisans)
2. **Brand** — everything under olu.lu, or a separate brand/domain for services?
3. **Resend** as the email provider — OK to add? (free tier, no cost at v1 volume)
4. **Pricing default** — CPL or subscription as the primary pitch?
5. **Free-launch cutoff** — date-based or leads-received-based?
