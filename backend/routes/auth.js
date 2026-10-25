import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { getUserByEmail, createUser, getFarm, createFarm, updateFarm } from '../db.js';
import { startTrialSubscription } from '../billing.js';
import { assignCustomerNumber } from '../accounting.js';
import { queueMail } from '../mail/index.js';
import { welcomeEmail } from '../mail/templates.js';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';

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
router.post('/register', async (req, res, next) => {
  try {
    const { farmName, village, ownerName, stockBrand, email, password } = req.body;
    if (!farmName || !ownerName || !email || !password) {
      return res.status(400).json({ error: 'farmName, ownerName, email and password are required' });
    }

    const existing = await getUserByEmail(email);
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

    await createFarm(farm);
    await createUser(user);
    const { trialEnd } = await startTrialSubscription(farm.id, { id: nanoid(10) });

    // The customer number is nice to have in the response, but the signup has
    // already succeeded by now, so a failure here must not undo it. Startup
    // backfills any farm that is still missing a number.
    try {
      farm.customer_number = await assignCustomerNumber(farm.id);
    } catch (err) {
      console.error('Could not assign a customer number:', err.message);
    }
    if (farm.customer_number) {
      // Fire-and-forget: the email never delays or fails the signup.
      queueMail({
        to: user.email, toName: ownerName, farmId: farm.id, template: 'welcome',
        ...welcomeEmail({
          ownerName, farmName, customerNumber: farm.customer_number, trialEnd,
          appUrl: process.env.APP_URL, supportEmail: process.env.SUPPORT_EMAIL,
        }),
      });
    }

    res.status(201).json({ token: sign(user), farm, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const farm = await getFarm(user.farm_id);
    res.json({ token: sign(user), farm, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// Update farm profile fields (village, stock brand, etc.)
router.put('/farm', requireAuth, async (req, res, next) => {
  try {
    const { village, stockBrand } = req.body;
    const updated = await updateFarm(req.user.farmId, {
      ...(village !== undefined && { village }),
      ...(stockBrand !== undefined && { stock_brand: stockBrand }),
    });
    if (!updated) return res.status(404).json({ error: 'Farm not found' });
    res.json({ farm: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
