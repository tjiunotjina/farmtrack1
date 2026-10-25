import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { initBillingSchema, seedPlans } from './billing.js';
import { initAccountingSchema } from './accounting.js';
import { initMailSchema } from './mail/index.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import billingRoutes from './routes/billing.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import registerResourceRoutes from './routes/resources.js';

const app = express();
// Behind Render's proxy, trust one hop so req.ip is the real client address
// (the admin login attempt limiter depends on it).
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

await initDb();
await initBillingSchema();
await seedPlans();
await initAccountingSchema();
await initMailSchema();

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);
registerResourceRoutes(app);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Routes call next(err) on failure (see routes/*.js) instead of letting a
// rejected promise crash the process — this is what actually turns those
// into a clean JSON response.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Orutumbo API listening on :${PORT}`));
