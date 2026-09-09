import { Router } from 'express';
import { nanoid } from 'nanoid';
import { COLLECTIONS, getRecords, getRecord, upsertRecord } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

function makeRouter(collection) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const items = await getRecords(req.user.farmId, collection);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const record = {
        id: nanoid(10),
        updated_at: new Date().toISOString(),
        deleted: false,
        ...req.body,
      };
      await upsertRecord(req.user.farmId, collection, record);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
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
