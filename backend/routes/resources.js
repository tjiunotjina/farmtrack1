import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

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

  router.put('/:id', async (req, res, next) => {
    try {
      const existing = await getRecord(req.user.farmId, collection, req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const updated = { ...existing, ...req.body, id: req.params.id, updated_at: new Date().toISOString() };
      await upsertRecord(req.user.farmId, collection, updated);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const existing = await getRecord(req.user.farmId, collection, req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      await upsertRecord(req.user.farmId, collection, { ...existing, deleted: true, updated_at: new Date().toISOString() });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default function registerResourceRoutes(app) {
  for (const collection of COLLECTIONS) {
    app.use(`/api/${collection}`, makeRouter(collection));
  }
}
