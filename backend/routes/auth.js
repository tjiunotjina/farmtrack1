
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import {
  getUserByEmail,
  createUser,
  getFarm,
  createFarm,
  updateFarm,
} from '../db.js';
import { startTrialSubscription } from '../billing.js';
import { assignCustomerNumber } from '../accounting.js';
import { queueMail } from '../mail/index.js';
import { welcomeEmail } from '../mail/templates.js';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';

const router = Router();

function sign(user) {
  return jwt.sign(
    {
      userId: user.id,
      farmId: user.farm_id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Register a new farm and its owner account.
// Each farm is an isolated tenant. Records must be scoped by farm_id.
router.post('/register', async (req, res, next) => {
  try {
    const {
      farmName,
      village,
      ownerName,
      stockBrand,
      email,
      password,
    } = req.body;

    if (!farmName || !ownerName || !email || !password) {
      return res.status(400).json({
        error: 'farmName, ownerName, email and password are required',
      });
    }

    const existing = await getUserByEmail(email);

    if (existing) {
      return res.status(409).json({
        error: 'An account with that email already exists',
      });
    }

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

    // Persist the farm and owner using the PostgreSQL database helpers.
    await createFarm(farm);
    await createUser(user);

    // Start the farm's trial subscription.
    const { trialEnd } = await startTrialSubscription(farm.id, {
      id: nanoid(10),
    });

    // Assign a permanent customer number. A numbering failure must not
    // prevent an otherwise successful registration.
    try {
      farm.customer_number = await assignCustomerNumber(farm.id);
    } catch (err) {
      console.error('Could not assign a customer number:', err.message);
    }

    // Send the welcome email asynchronously; email failure must not
    // delay or fail registration.
    if (farm.customer_number) {
      try {
        Promise.resolve(
          queueMail({
            to: user.email,
            toName: ownerName,
            farmId: farm.id,
            template: 'welcome',
            ...welcomeEmail({
              ownerName,
              farmName,
              customerNumber: farm.customer_number,
              trialEnd,
              appUrl: process.env.APP_URL,
              supportEmail: process.env.SUPPORT_EMAIL,
            }),
          })
        ).catch((err) => {
          console.error('Could not queue welcome email:', err.message);
        });
      } catch (err) {
        console.error('Could not queue welcome email:', err.message);
      }
    }

    return res.status(201).json({
      token: sign(user),
      farm,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Log in an existing user.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const farm = await getFarm(user.farm_id);

    return res.json({
      token: sign(user),
      farm,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update farm profile fields such as village and stock brand.
router.put('/farm', requireAuth, async (req, res, next) => {
  try {
    const { village, stockBrand } = req.body;

    const updated = await updateFarm(req.user.farmId, {
      ...(village !== undefined && { village }),
      ...(stockBrand !== undefined && { stock_brand: stockBrand }),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    return res.json({ farm: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
