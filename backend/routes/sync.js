import { Router } from 'express';
import { COLLECTIONS, upsertRecord, getRecords } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// PUSH: client sends every record it queued while offline (creates,
// edits, deletes-as-soft-delete). Conflict rule: last-write-wins on
// `updated_at`, resolved atomically per-record in Postgres (see
// db.js's upsertRecord) rather than a read-modify-write in this file —
// safe even if two requests land at the same time.
router.post('/push', async (req, res, next) => {
  try {
    const { collection, records } = req.body;
    if (!COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

    const applied = [];
    for (const rec of records) {
      if (!rec.id) continue;
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
