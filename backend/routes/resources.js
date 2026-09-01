import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const COLLECTIONS = ['animals', 'inventory', 'ledger', 'tasks'];

function makeRouter(collection) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    await db.read();
    const items = db.data[collection].filter(r => r.farm_id === req.user.farmId && !r.deleted);
    res.json(items);
  });

  router.post('/', async (req, res) => {
    await db.read();
    const record = {
      id: nanoid(10),
      farm_id: req.user.farmId,
      updated_at: new Date().toISOString(),
      deleted: false,
      ...req.body,
    };
    db.data[collection].push(record);
    await db.write();
    res.status(201).json(record);
  });

  router.put('/:id', async (req, res) => {
    await db.read();
    const idx = db.data[collection].findIndex(r => r.id === req.params.id && r.farm_id === req.user.farmId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.data[collection][idx] = { ...db.data[collection][idx], ...req.body, updated_at: new Date().toISOString() };
    await db.write();
    res.json(db.data[collection][idx]);
  });

  router.delete('/:id', async (req, res) => {
    await db.read();
    const idx = db.data[collection].findIndex(r => r.id === req.params.id && r.farm_id === req.user.farmId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.data[collection][idx].deleted = true;
    db.data[collection][idx].updated_at = new Date().toISOString();
    await db.write();
    res.status(204).end();
  });

  return router;
}

export default function registerResourceRoutes(app) {
  for (const collection of COLLECTIONS) {
    app.use(`/api/${collection}`, makeRouter(collection));
  }
}
