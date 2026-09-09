import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    'DATABASE_URL is not set. Set it to a Postgres connection string ' +
    '(e.g. from Render\u2019s Postgres dashboard) before starting the server.'
  );
}

// Render (and most managed Postgres hosts) require SSL for external
// connections, with a certificate that Node's default TLS check won't
// recognize — rejectUnauthorized: false is the standard, documented way to
// connect to Render Postgres from outside their internal network.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') || process.env.PGSSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

const COLLECTIONS = ['animals', 'inventory', 'ledger', 'tasks', 'farmers'];

// Called once at server startup. Safe to run every time — CREATE TABLE IF
// NOT EXISTS means an already-initialized database is untouched.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      village TEXT DEFAULT '',
      owner_name TEXT NOT NULL,
      stock_brand TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL REFERENCES farms(id),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // One table holds every animal/inventory/ledger/task/farmer record,
  // keyed by (collection, id). The record's actual fields live in a JSONB
  // column rather than fixed SQL columns — these records have grown new
  // fields many times over this project (photos, vaccinations, birth date,
  // stock links...) and JSONB lets that keep happening without a schema
  // migration every time, while still getting Postgres's real durability,
  // backups, and concurrent-write safety that the JSON file never had.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      farm_id TEXT NOT NULL REFERENCES farms(id),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      deleted BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (collection, id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_records_farm ON records (farm_id, collection);`);
}

// ---- Farms & users ----

export async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function createUser(user) {
  await pool.query(
    `INSERT INTO users (id, farm_id, email, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.id, user.farm_id, user.email, user.password_hash, user.role, user.created_at]
  );
}

export async function getFarm(farmId) {
  const { rows } = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
  return rows[0] || null;
}

export async function createFarm(farm) {
  await pool.query(
    `INSERT INTO farms (id, name, village, owner_name, stock_brand, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [farm.id, farm.name, farm.village, farm.owner_name, farm.stock_brand, farm.created_at]
  );
}

export async function updateFarm(farmId, patch) {
  const current = await getFarm(farmId);
  if (!current) return null;
  const updated = { ...current, ...patch };
  await pool.query(
    `UPDATE farms SET village = $2, stock_brand = $3 WHERE id = $1`,
    [farmId, updated.village, updated.stock_brand]
  );
  return updated;
}

// ---- Records (animals, inventory, ledger, tasks, farmers) ----

export async function getRecords(farmId, collection, { includeDeleted = false, since = null } = {}) {
  const conditions = ['farm_id = $1', 'collection = $2'];
  const params = [farmId, collection];
  if (!includeDeleted) conditions.push('deleted = false');
  if (since) {
    params.push(since);
    conditions.push(`updated_at > $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT id, data, updated_at, deleted FROM records WHERE ${conditions.join(' AND ')}`,
    params
  );
  return rows.map(rowToRecord);
}

export async function getRecord(farmId, collection, id) {
  const { rows } = await pool.query(
    'SELECT id, data, updated_at, deleted FROM records WHERE farm_id = $1 AND collection = $2 AND id = $3',
    [farmId, collection, id]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// Upserts one record with last-write-wins conflict resolution, done
// atomically in the database rather than read-modify-write in application
// code (which would race under concurrent requests). Returns 'created',
// 'updated', or 'skipped_older'.
export async function upsertRecord(farmId, collection, record) {
  const { id, updated_at, deleted = false, ...fields } = record;
  const { rows } = await pool.query(
    `INSERT INTO records (collection, id, farm_id, data, updated_at, deleted)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (collection, id) DO UPDATE
       SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at,
           deleted = EXCLUDED.deleted, farm_id = EXCLUDED.farm_id
       WHERE records.updated_at <= EXCLUDED.updated_at
     RETURNING (xmax = 0) AS inserted`,
    [collection, id, farmId, JSON.stringify(fields), updated_at, deleted]
  );
  if (rows.length === 0) return 'skipped_older';
  return rows[0].inserted ? 'created' : 'updated';
}

function rowToRecord(row) {
  return { id: row.id, ...row.data, updated_at: row.updated_at.toISOString(), deleted: row.deleted };
}

export { COLLECTIONS };
