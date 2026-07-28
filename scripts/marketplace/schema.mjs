/**
 * Marketplace schema — spec: specs/marketplace-v1.md §3 + §10.
 * Statements are idempotent (IF NOT EXISTS) so migrate can re-run safely.
 */
export const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS verticals (
    id               INTEGER PRIMARY KEY,
    slug             TEXT UNIQUE NOT NULL,
    name_en          TEXT NOT NULL,
    name_fr          TEXT NOT NULL,
    attribute_schema TEXT NOT NULL DEFAULT '{}',
    lead_form_schema TEXT NOT NULL DEFAULT '{}',
    booking_enabled  INTEGER NOT NULL DEFAULT 0,
    active           INTEGER NOT NULL DEFAULT 1,
    sort             INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY,
    vertical_id INTEGER NOT NULL REFERENCES verticals(id),
    slug        TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    name_fr     TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    UNIQUE (vertical_id, slug)
  )`,

  `CREATE TABLE IF NOT EXISTS providers (
    id          INTEGER PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    vat_number  TEXT,
    email       TEXT NOT NULL,
    phone       TEXT,
    whatsapp    TEXT,
    website     TEXT,
    address     TEXT,
    commune     TEXT,
    logo_url    TEXT,
    photos      TEXT NOT NULL DEFAULT '[]',
    description_en TEXT,
    description_fr TEXT,
    languages   TEXT NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'draft',
    plan        TEXT NOT NULL DEFAULT 'free',
    cpl_cents   INTEGER,
    sales_rep   TEXT,
    signed_at   TEXT,
    notes       TEXT,
    source      TEXT,
    source_ref  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS provider_categories (
    provider_id INTEGER NOT NULL REFERENCES providers(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    PRIMARY KEY (provider_id, category_id)
  )`,

  `CREATE TABLE IF NOT EXISTS provider_coverage (
    provider_id  INTEGER NOT NULL REFERENCES providers(id),
    commune_slug TEXT NOT NULL,
    PRIMARY KEY (provider_id, commune_slug)
  )`,

  `CREATE TABLE IF NOT EXISTS offers (
    id          INTEGER PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    title_en    TEXT NOT NULL,
    title_fr    TEXT NOT NULL,
    price_type  TEXT NOT NULL,
    price_cents INTEGER,
    attributes  TEXT NOT NULL DEFAULT '{}',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS leads (
    id          TEXT PRIMARY KEY,
    vertical_id INTEGER NOT NULL REFERENCES verticals(id),
    category_id INTEGER REFERENCES categories(id),
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    commune     TEXT,
    message     TEXT,
    answers     TEXT NOT NULL DEFAULT '{}',
    locale      TEXT NOT NULL DEFAULT 'fr',
    source_page TEXT,
    status      TEXT NOT NULL DEFAULT 'new',
    consent_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS lead_dispatches (
    id           INTEGER PRIMARY KEY,
    lead_id      TEXT NOT NULL REFERENCES leads(id),
    provider_id  INTEGER NOT NULL REFERENCES providers(id),
    channel      TEXT NOT NULL DEFAULT 'email',
    status       TEXT NOT NULL DEFAULT 'pending',
    billable     INTEGER NOT NULL DEFAULT 0,
    billed_cents INTEGER,
    sent_at      TEXT,
    UNIQUE (lead_id, provider_id)
  )`,

  `CREATE TABLE IF NOT EXISTS lead_events (
    id          INTEGER PRIMARY KEY,
    lead_id     TEXT NOT NULL REFERENCES leads(id),
    dispatch_id INTEGER REFERENCES lead_dispatches(id),
    event       TEXT NOT NULL,
    actor       TEXT NOT NULL,
    meta        TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS booking_settings (
    provider_id      INTEGER PRIMARY KEY REFERENCES providers(id),
    mode             TEXT NOT NULL DEFAULT 'request',
    slot_minutes     INTEGER NOT NULL DEFAULT 60,
    buffer_minutes   INTEGER NOT NULL DEFAULT 0,
    min_lead_hours   INTEGER NOT NULL DEFAULT 24,
    max_horizon_days INTEGER NOT NULL DEFAULT 60
  )`,

  `CREATE TABLE IF NOT EXISTS availability_rules (
    id          INTEGER PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id),
    weekday     INTEGER NOT NULL,
    open_time   TEXT NOT NULL,
    close_time  TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id)
  )`,

  `CREATE TABLE IF NOT EXISTS availability_exceptions (
    id          INTEGER PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id),
    date        TEXT NOT NULL,
    closed      INTEGER NOT NULL DEFAULT 1,
    open_time   TEXT,
    close_time  TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS appointments (
    id            TEXT PRIMARY KEY,
    lead_id       TEXT REFERENCES leads(id),
    provider_id   INTEGER NOT NULL REFERENCES providers(id),
    category_id   INTEGER REFERENCES categories(id),
    offer_id      INTEGER REFERENCES offers(id),
    starts_at     TEXT,
    duration_min  INTEGER,
    status        TEXT NOT NULL DEFAULT 'requested',
    confirm_token TEXT UNIQUE,
    manage_token  TEXT UNIQUE,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS consumed_login_tokens (
    token_hash TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS reviews (
    id             TEXT PRIMARY KEY,
    provider_id    INTEGER NOT NULL REFERENCES providers(id),
    appointment_id TEXT REFERENCES appointments(id),
    lead_id        TEXT REFERENCES leads(id),
    author_name    TEXT NOT NULL,
    rating         INTEGER NOT NULL,
    comment        TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    moderated_at   TEXT,
    UNIQUE (appointment_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id, status)`,

  `CREATE TABLE IF NOT EXISTS provider_claims (
    id           TEXT PRIMARY KEY,
    provider_id  INTEGER NOT NULL REFERENCES providers(id),
    contact_name TEXT NOT NULL,
    email        TEXT NOT NULL,
    phone        TEXT,
    message      TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    handled_at   TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_claims_status ON provider_claims(status, created_at)`,

  `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_dispatches_provider ON lead_dispatches(provider_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_offers_category ON offers(category_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_coverage_commune ON provider_coverage(commune_slug)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status, starts_at)`,
];

/**
 * Idempotent ADD COLUMN migrations for tables that predate a column.
 * migrate.mjs applies these (after CREATE TABLE, before POST_INDEXES) only
 * when the column is missing (SQLite has no ADD COLUMN IF NOT EXISTS).
 */
export const ALTERS = [
  { table: "providers", column: "source", ddl: "ALTER TABLE providers ADD COLUMN source TEXT" },
  { table: "providers", column: "source_ref", ddl: "ALTER TABLE providers ADD COLUMN source_ref TEXT" },
  { table: "providers", column: "opening_hours", ddl: "ALTER TABLE providers ADD COLUMN opening_hours TEXT" },
  { table: "providers", column: "lat", ddl: "ALTER TABLE providers ADD COLUMN lat REAL" },
  { table: "providers", column: "lon", ddl: "ALTER TABLE providers ADD COLUMN lon REAL" },
];

/** Indexes that reference columns added by ALTERS — created last. */
export const POST_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_providers_source ON providers(source, source_ref)`,
];
