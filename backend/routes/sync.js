
import { Router } from 'express';
import {
  COLLECTIONS,
  getRecord,
  getRecords,
  upsertRecord,
} from '../db.js';
import { getFeatureLimit } from '../billing.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/push', async (req, res, next) => {
  try {
    const { collection, records } = req.body ?? {};

    if (!COLLECTIONS.includes(collection)) {
      return res.status(400).json({ error: 'Unknown collection' });
    }

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'records must be an array' });
    }

    const farmId = req.user.farmId;
    const applied = [];

    // Count existing, non-deleted animals before processing this batch.
    // Keep track of new animals accepted during this request as well.
    let animalCount = null;
    let animalLimit = null;

    if (collection === 'animals') {
      const existingAnimals = await getRecords(farmId, 'animals');
      animalCount = existingAnimals.length;
      animalLimit = await getFeatureLimit(farmId, 'max_livestock');
    }

    for (const rec of records) {
      if (!rec || typeof rec.id !== 'string' || !rec.id.trim()) {
        continue;
      }

      // Never allow a client to write to another farm's records.
      const existing = await getRecord(farmId, collection, rec.id);

      // Do not count a new animal against the limit if it is an update.
      const isNewAnimal =
        collection === 'animals' &&
        !existing &&
        !rec.deleted;

      if (
        isNewAnimal &&
        animalLimit !== null &&
        animalCount >= animalLimit
      ) {
        applied.push({ id: rec.id, status: 'limit_exceeded' });
        continue;
      }

      const incoming = {
        ...rec,
        id: rec.id,
        updated_at: rec.updated_at || new Date().toISOString(),
        deleted: Boolean(rec.deleted),
      };

      const status = await upsertRecord(farmId, collection, incoming);

      applied.push({ id: rec.id, status });

      if (isNewAnimal && status === 'created') {
        animalCount += 1;
      }
    }

    return res.json({
      applied,
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/pull', async (req, res, next) => {
  try {
    const since = req.query.since || null;
    const result = {};

    for (const collection of COLLECTIONS) {
      result[collection] = await getRecords(
        req.user.farmId,
        collection,
        { includeDeleted: true, since },
      );
    }

    result.server_time = new Date().toISOString();

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
