import { Router } from 'express';
import { COLLECTIONS, upsertRecord, getRecords } from '../db.js';
import { getFeatureLimit, LIMITED_COLLECTIONS } from '../billing.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// PUSH: client sends every record it queued while offline (creates,
// edits, deletes-as-soft-delete). Conflict rule: last-write-wins on
// `updated_at`, resolved atomically per-record in Postgres (see
// db.js's upsertRecord) rather than a read-modify-write in this file —
// safe even if two requests land at the same time.
//
// Plan limits (e.g. max_livestock) are enforced here too, not just on the
// plain REST create route — this app is offline-first, so most animals
// are actually created through this endpoint when the device reconnects,
// not through POST /api/animals directly. A record that would exceed the
// limit is reported back as 'limit_exceeded' and is NOT persisted; it
// stays queued (dirty) on the client until the farm upgrades or frees up
// room, rather than silently vanishing or silently being let through.
router.post('/push', async (req, res, next) => {
  try {
    const { collection, records } = req.body;
    if (!COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

    const limitKey = LIMITED_COLLECTIONS[collection];
    let remainingSlots = Infinity;
    let existingActiveIds = new Set();
    if (limitKey) {
      const existing = await getRecords(req.user.farmId, collection, { includeDeleted: true });
      existingActiveIds = new Set(existing.filter(r => !r.deleted).map(r => r.id));
      const limit = await getFeatureLimit(req.user.farmId, limitKey);
      remainingSlots = limit === null ? Infinity : Math.max(0, limit - existingActiveIds.size);
    }

    const applied = [];
    for (const rec of records) {
      if (!rec.id) continue;

      if (limitKey) {
        const isNewActiveRecord = !existingActiveIds.has(rec.id) && !rec.deleted;
        if (isNewActiveRecord) {
          if (remainingSlots <= 0) {
            applied.push({ id: rec.id, status: 'limit_exceeded' });
            continue;
          }
          remainingSlots -= 1;
        }
      }

      const status = await upsertRecord(req.user.farmId, collection, rec);
      applied.push({ id: rec.id, status });
    }

    res.json({ applied, server_time: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// PULL: client asks "what changed since I last synced" for each
// collection, scoped to its own farm only.
router.get('/pull', async (req, res, next) => {
  try {
    const since = req.query.since || new Date(0).toISOString();

    const result = {};
    for (const collection of COLLECTIONS) {
      result[collection] = await getRecords(req.user.farmId, collection, { includeDeleted: true, since });
    }
    result.server_time = new Date().toISOString();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
