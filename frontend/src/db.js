import Dexie from 'dexie';

// Every screen in this app reads and writes to IndexedDB directly — never
// straight to the network. That's what makes it offline-first: the UI
// never has to know or care whether a connection exists. The sync module
// (sync.js) is the only thing that talks to the server, in the background.
export const db = new Dexie('farmtrack');

db.version(1).stores({
  meta: 'key',
  animals: 'id, dirty, updated_at',
  inventory: 'id, dirty, updated_at',
  ledger: 'id, dirty, updated_at',
  tasks: 'id, dirty, updated_at',
});

// v2 adds farmers (the people working the farm — not login accounts, just
// a roster: name, role, phone). New Dexie version required to add a table.
db.version(2).stores({
  meta: 'key',
  animals: 'id, dirty, updated_at',
  inventory: 'id, dirty, updated_at',
  ledger: 'id, dirty, updated_at',
  tasks: 'id, dirty, updated_at',
  farmers: 'id, dirty, updated_at',
});

export const COLLECTIONS = ['animals', 'inventory', 'ledger', 'tasks', 'farmers'];

export async function getMeta(key) {
  const row = await db.meta.get(key);
  return row?.value;
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value });
}

// Write helper used by every screen: stamps the record dirty + timestamped
// so the sync engine knows to push it next time it runs.
export async function saveLocal(collection, record) {
  const now = new Date().toISOString();
  const full = { ...record, updated_at: now, dirty: 1, deleted: record.deleted ?? 0 };
  await db.table(collection).put(full);
  return full;
}

export async function softDeleteLocal(collection, id) {
  const existing = await db.table(collection).get(id);
  if (!existing) return;
  await saveLocal(collection, { ...existing, deleted: 1 });
}
