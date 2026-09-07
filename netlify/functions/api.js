import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { getUser, setUser, getFarm, setFarm, getFarmData, setFarmData } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COLLECTIONS = ['animals', 'inventory', 'ledger', 'tasks', 'farmers'];

const app = express();
app.use(cors());
app.use(express.json());

function sign(user) {
  return jwt.sign(
    { userId: user.id, farmId: user.farm_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Express doesn't catch rejected promises from async route handlers on its
// own — an unhandled one here would crash the whole function invocation
// (a 502, no JSON body) instead of a clean error response. Wrap every
// async handler with this so failures come back as normal JSON errors.
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));

// ---- Auth ----

router.post('/auth/register', asyncRoute(async (req, res) => {
  const { farmName, village, ownerName, stockBrand, email, password } = req.body;
  if (!farmName || !ownerName || !email || !password) {
    return res.status(400).json({ error: 'farmName, ownerName, email and password are required' });
  }

  const existing = await getUser(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const farm = {
    id: nanoid(10),
    name: farmName,
    village: village || '',
    owner_name: ownerName,
    stock_brand: stockBrand || '',
    created_at: new Date().toISOString(),
  };
  const password_hash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(10),
    farm_id: farm.id,
    email,
    password_hash,
    role: 'owner',
    created_at: new Date().toISOString(),
  };

  await setFarm(farm.id, farm);
  await setUser(email, user);
  await setFarmData(farm.id, { animals: [], inventory: [], ledger: [], tasks: [], farmers: [] });

  res.status(201).json({ token: sign(user), farm, user: { id: user.id, email: user.email, role: user.role } });
}));

router.post('/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  const user = await getUser(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const farm = await getFarm(user.farm_id);
  res.json({ token: sign(user), farm, user: { id: user.id, email: user.email, role: user.role } });
}));

router.put('/auth/farm', requireAuth, asyncRoute(async (req, res) => {
  const farm = await getFarm(req.user.farmId);
  if (!farm) return res.status(404).json({ error: 'Farm not found' });
  const { village, stockBrand } = req.body;
  const updated = {
    ...farm,
    ...(village !== undefined && { village }),
    ...(stockBrand !== undefined && { stock_brand: stockBrand }),
  };
  await setFarm(req.user.farmId, updated);
  res.json({ farm: updated });
}));

// ---- Sync (offline push/pull) ----

router.post('/sync/push', requireAuth, asyncRoute(async (req, res) => {
  const { collection, records } = req.body;
  if (!COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

  const data = await getFarmData(req.user.farmId);
  const list = data[collection];
  const applied = [];

  for (const rec of records) {
    if (!rec.id) continue;
    const idx = list.findIndex(r => r.id === rec.id);
    const incoming = { ...rec, farm_id: req.user.farmId };

    if (idx === -1) {
      list.push(incoming);
      applied.push({ id: rec.id, status: 'created' });
    } else if (new Date(incoming.updated_at) >= new Date(list[idx].updated_at)) {
      list[idx] = incoming;
      applied.push({ id: rec.id, status: 'updated' });
    } else {
      applied.push({ id: rec.id, status: 'skipped_older' });
    }
  }

  await setFarmData(req.user.farmId, data);
  res.json({ applied, server_time: new Date().toISOString() });
}));

router.get('/sync/pull', requireAuth, asyncRoute(async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(0);
  const data = await getFarmData(req.user.farmId);

  const result = {};
  for (const collection of COLLECTIONS) {
    result[collection] = data[collection].filter(r => new Date(r.updated_at) > since);
  }
  result.server_time = new Date().toISOString();
  res.json(result);
}));

// ---- Plain online CRUD per collection (used outside the offline queue) ----

function resourceRouter(collection) {
  const r = express.Router();

  r.get('/', requireAuth, asyncRoute(async (req, res) => {
    const data = await getFarmData(req.user.farmId);
    res.json(data[collection].filter(x => !x.deleted));
  }));

  r.post('/', requireAuth, asyncRoute(async (req, res) => {
    const data = await getFarmData(req.user.farmId);
    const record = {
      id: nanoid(10),
      farm_id: req.user.farmId,
      updated_at: new Date().toISOString(),
      deleted: false,
      ...req.body,
    };
    data[collection].push(record);
    await setFarmData(req.user.farmId, data);
    res.status(201).json(record);
  }));

  r.put('/:id', requireAuth, asyncRoute(async (req, res) => {
    const data = await getFarmData(req.user.farmId);
    const idx = data[collection].findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data[collection][idx] = { ...data[collection][idx], ...req.body, updated_at: new Date().toISOString() };
    await setFarmData(req.user.farmId, data);
    res.json(data[collection][idx]);
  }));

  r.delete('/:id', requireAuth, asyncRoute(async (req, res) => {
    const data = await getFarmData(req.user.farmId);
    const idx = data[collection].findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data[collection][idx].deleted = true;
    data[collection][idx].updated_at = new Date().toISOString();
    await setFarmData(req.user.farmId, data);
    res.status(204).end();
  }));

  return r;
}

for (const collection of COLLECTIONS) {
  router.use(`/${collection}`, resourceRouter(collection));
}

app.use('/api', router);

// Anything asyncRoute caught (or any sync throw) lands here instead of
// crashing the function invocation — always a clean JSON error response.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

export const handler = serverless(app);
