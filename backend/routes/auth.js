import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

function sign(user) {
  return jwt.sign(
    { userId: user.id, farmId: user.farm_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Register a new farm + its owner account.
// Each farm is an isolated tenant — every record created afterwards is
// scoped to farm_id so one farmer never sees another farmer's data.
router.post('/register', async (req, res) => {
  const { farmName, village, ownerName, stockBrand, email, password } = req.body;
  if (!farmName || !ownerName || !email || !password) {
    return res.status(400).json({ error: 'farmName, ownerName, email and password are required' });
  }

  await db.read();
  const existing = db.data.users.find(u => u.email === email);
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

  db.data.farms.push(farm);
  db.data.users.push(user);
  await db.write();

  res.status(201).json({ token: sign(user), farm, user: { id: user.id, email: user.email, role: user.role } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const farm = db.data.farms.find(f => f.id === user.farm_id);
  res.json({ token: sign(user), farm, user: { id: user.id, email: user.email, role: user.role } });
});

// Update farm profile fields (village, stock brand, etc.)
router.put('/farm', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  await db.read();
  const idx = db.data.farms.findIndex(f => f.id === payload.farmId);
  if (idx === -1) return res.status(404).json({ error: 'Farm not found' });

  const { farmName, village, ownerName, stockBrand } = req.body;
  db.data.farms[idx] = {
    ...db.data.farms[idx],
    ...(farmName && { name: farmName }),
    ...(village !== undefined && { village }),
    ...(ownerName && { owner_name: ownerName }),
    ...(stockBrand !== undefined && { stock_brand: stockBrand }),
  };
  await db.write();
  res.json({ farm: db.data.farms[idx] });
});

export default router;
