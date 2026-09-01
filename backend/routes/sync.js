import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const COLLECTIONS = ['animals', 'inventory', 'ledger', 'tasks'];

router.use(requireAuth);

// PUSH: client sends every record it queued while offline (creates,
// edits, deletes-as-soft-delete). Conflict rule: last-write-wins on
// `updated_at` — simple, predictable, good enough for single-farm data
// where two people rarely edit the exact same animal in the same minute.
router.post('/push', async (req, res) => {
  const { collection, records } = req.body;
  if (!COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

  await db.read();
  const store = db.data[collection];
  const applied = [];

  for (const rec of records) {
    if (!rec.id) continue;
    const existingIdx = store.findIndex(r => r.id === rec.id && r.farm_id === req.user.farmId);
    const incoming = { ...rec, farm_id: req.user.farmId };

    if (existingIdx === -1) {
      store.push(incoming);
      applied.push({ id: rec.id, status: 'created' });
    } else if (new Date(incoming.updated_at) >= new Date(store[existingIdx].updated_at)) {
      store[existingIdx] = incoming;
      applied.push({ id: rec.id, status: 'updated' });
    } else {
      applied.push({ id: rec.id, status: 'skipped_older' });
    }
  }

  await db.write();
  res.json({ applied, server_time: new Date().toISOString() });
});

// PULL: client asks "what changed since I last synced" for each
// collection, scoped to its own farm only.
router.get('/pull', async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(0);
  await db.read();

  const result = {};
  for (const collection of COLLECTIONS) {
    result[collection] = db.data[collection].filter(
      r => r.farm_id === req.user.farmId && new Date(r.updated_at) > since
    );
  }
  result.server_time = new Date().toISOString();
  res.json(result);
});

export default router;
