
import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  COLLECTIONS,
  getRecords,
  getRecord,
  upsertRecord,
} from '../db.js';
import {
  LIMITED_COLLECTIONS,
  getFeatureLimit,
} from '../billing.js';
import { requireAuth } from '../middleware/auth.js';

function makeRouter(collection) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const items = await getRecords(req.user.farmId, collection);
      return res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const farmId = req.user.farmId;
      const body = req.body ?? {};

      // Do not allow clients to override server-owned fields.
      const record = {
        ...body,
        id: nanoid(10),
        updated_at: new Date().toISOString(),
        deleted: false,
      };

      const featureKey = LIMITED_COLLECTIONS[collection];

      if (featureKey) {
        const limit = await getFeatureLimit(farmId, featureKey);

        if (limit !== null) {
          const existingRecords = await getRecords(farmId, collection);

          if (existingRecords.length >= limit) {
            return res.status(403).json({
              error: 'Plan limit reached',
              code: 'limit_exceeded',
              collection,
              limit,
            });
          }
        }
      }

      const status = await upsertRecord(farmId, collection, record);

      if (status !== 'created') {
        return res.status(409).json({
          error: 'Could not create record',
        });
      }

      return res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const farmId = req.user.farmId;
      const existing = await getRecord(
        farmId,
        collection,
        req.params.id,
      );

      if (!existing || existing.deleted) {
        return res.status(404).json({ error: 'Not found' });
      }

      const updated = {
        ...existing,
        ...(req.body ?? {}),
        id: existing.id,
        updated_at: new Date().toISOString(),
        deleted: false,
      };

      const status = await upsertRecord(farmId, collection, updated);

      if (status === 'skipped_older') {
        return res.status(409).json({
          error: 'Record changed; please retry',
        });
      }

      return res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const farmId = req.user.farmId;
      const existing = await getRecord(
        farmId,
        collection,
        req.params.id,
      );

      if (!existing || existing.deleted) {
        return res.status(404).json({ error: 'Not found' });
      }

      await upsertRecord(farmId, collection, {
        ...existing,
        deleted: true,
        updated_at: new Date().toISOString(),
      });

      return res.status(204).end();
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
