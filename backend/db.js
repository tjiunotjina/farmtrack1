import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'data.json');
const adapter = new JSONFile(file);

// Default shape. Every farm-owned record carries `farm_id` so a single
// store can safely hold many farms (multi-tenant) — swap this file for a
// real database later without changing the API layer above it.
const defaultData = {
  farms: [],      // { id, name, village, owner_name, created_at }
  users: [],       // { id, farm_id, email, password_hash, role }
  animals: [],      // { id, farm_id, updated_at, deleted, ...fields }
  inventory: [],
  ledger: [],
  tasks: [],
  farmers: [],      // roster of people working the farm — name, role, phone
};

export const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  db.data ||= structuredClone(defaultData);
  // Fill in any keys added since a given data.json was first created —
  // an existing file won't get new collections automatically otherwise.
  for (const key of Object.keys(defaultData)) {
    db.data[key] ||= structuredClone(defaultData[key]);
  }
  await db.write();
}
