import { db, COLLECTIONS, getMeta, setMeta } from './db.js';
import { api } from './api.js';

let syncing = false;

/**
 * Runs one full sync cycle: push everything queued locally while offline,
 * then pull anything that changed on the server since last time.
 * Safe to call repeatedly — it's a no-op if already running or offline.
 */
export async function runSync(token, onStatusChange) {
  if (syncing || !navigator.onLine || !token) return { ok: false, reason: 'skipped' };
  syncing = true;
  onStatusChange?.('syncing');

  try {
    let pushedCount = 0;
    const limitExceeded = [];

    for (const collection of COLLECTIONS) {
      const dirty = await db.table(collection).where('dirty').equals(1).toArray();
      if (dirty.length === 0) continue;

      const { applied } = await api.syncPush(token, collection, dirty);
      pushedCount += applied.length;

      // Only 'created'/'updated' actually landed on the server — clearing
      // dirty for those is correct. A record marked 'limit_exceeded' was
      // NOT persisted server-side (this app is offline-first, so the add
      // already happened locally before the plan limit could be checked);
      // clearing its dirty flag would make it look synced when it was
      // silently dropped. Leave it dirty and surface it instead, so the
      // farmer finds out rather than quietly losing the record.
      await db.transaction('rw', db.table(collection), async () => {
        for (const item of applied) {
          if (item.status === 'limit_exceeded') {
            limitExceeded.push({ collection, id: item.id });
            continue;
          }
          const rec = await db.table(collection).get(item.id);
          if (rec) await db.table(collection).put({ ...rec, dirty: 0 });
        }
      });
    }

    await setMeta('limitExceeded', limitExceeded);

    const lastSync = (await getMeta('lastSync')) || new Date(0).toISOString();
    const pulled = await api.syncPull(token, lastSync);

    for (const collection of COLLECTIONS) {
      const rows = pulled[collection] || [];
      if (rows.length) {
        await db.table(collection).bulkPut(rows.map(r => ({ ...r, dirty: 0 })));
      }
    }

    await setMeta('lastSync', pulled.server_time);
    onStatusChange?.('synced');
    return { ok: true, pushedCount, pulledCount: Object.values(pulled).flat().length, limitExceeded };
  } catch (err) {
    onStatusChange?.('error');
    return { ok: false, error: err.message };
  } finally {
    syncing = false;
  }
}

export async function pendingCount() {
  let total = 0;
  for (const collection of COLLECTIONS) {
    total += await db.table(collection).where('dirty').equals(1).count();
  }
  return total;
}
