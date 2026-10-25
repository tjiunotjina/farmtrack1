import { pool } from './db.js';

// ---- Schema ----

export async function initBillingSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      monthly_price NUMERIC NOT NULL,
      annual_price NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NAD',
      trial_days INTEGER NOT NULL DEFAULT 0,
      most_popular BOOLEAN NOT NULL DEFAULT false,
      contact_sales BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Centralized entitlements: every plan/feature check in the app reads
  // this table (via getFeatureValue/hasFeature below) rather than having
  // "if plan === 'standard'" scattered through routes and components —
  // so changing what a plan includes is a data change, not a code change.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_features (
      id SERIAL PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL,
      feature_value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (plan_id, feature_key)
    );
  `);

  // A subscription belongs to the farm, not an individual user — the farm
  // owner controls billing, and every member of that farm shares the plan.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL UNIQUE REFERENCES farms(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      provider TEXT NOT NULL DEFAULT 'manual',
      provider_customer_id TEXT,
      provider_subscription_id TEXT,
      trial_start TIMESTAMPTZ,
      trial_end TIMESTAMPTZ,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      next_billing_date TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      cancellation_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_farm ON subscriptions (farm_id);`);
}

// ---- Seed the pricing tiers from the spec (idempotent — safe to call on every startup) ----

const PLAN_SEED = [
  {
    id: 'free', name: 'Free', slug: 'free', monthlyPrice: 0, annualPrice: 0, trialDays: 0, sortOrder: 0,
    features: {
      max_farms: '1', max_team_members: '1', max_livestock: '15',
      livestock_management: 'true', crop_management: 'false', inventory: 'true',
      reports: 'false', advanced_reports: 'false', data_export: 'false',
      team_members: 'false', offline_mode: 'true', priority_support: 'false',
    },
  },
  {
    id: 'basic', name: 'Basic', slug: 'basic', monthlyPrice: 99, annualPrice: 990, trialDays: 0, sortOrder: 1,
    features: {
      max_farms: '1', max_team_members: '3', max_livestock: '100',
      livestock_management: 'true', crop_management: 'true', inventory: 'true',
      reports: 'true', advanced_reports: 'false', data_export: 'false',
      team_members: 'true', offline_mode: 'true', priority_support: 'false',
    },
  },
  {
    id: 'standard', name: 'Standard', slug: 'standard', monthlyPrice: 199, annualPrice: 1990, trialDays: 30, sortOrder: 2, mostPopular: true,
    features: {
      max_farms: '2', max_team_members: '8', max_livestock: '500',
      livestock_management: 'true', crop_management: 'true', inventory: 'true',
      reports: 'true', advanced_reports: 'true', data_export: 'true',
      team_members: 'true', offline_mode: 'true', priority_support: 'false',
    },
  },
  {
    id: 'professional', name: 'Professional', slug: 'professional', monthlyPrice: 399, annualPrice: 3990, trialDays: 0, sortOrder: 3,
    features: {
      max_farms: '5', max_team_members: '20', max_livestock: '-1', // -1 = unlimited
      livestock_management: 'true', crop_management: 'true', inventory: 'true',
      reports: 'true', advanced_reports: 'true', data_export: 'true',
      team_members: 'true', offline_mode: 'true', priority_support: 'true',
    },
  },
  {
    id: 'enterprise', name: 'Enterprise', slug: 'enterprise', monthlyPrice: 0, annualPrice: 0, trialDays: 0, sortOrder: 4, contactSales: true,
    features: {
      max_farms: '-1', max_team_members: '-1', max_livestock: '-1',
      livestock_management: 'true', crop_management: 'true', inventory: 'true',
      reports: 'true', advanced_reports: 'true', data_export: 'true',
      team_members: 'true', offline_mode: 'true', priority_support: 'true',
    },
  },
];

export async function seedPlans() {
  for (const p of PLAN_SEED) {
    await pool.query(
      `INSERT INTO plans (id, name, slug, monthly_price, annual_price, currency, trial_days, most_popular, contact_sales, sort_order)
       VALUES ($1, $2, $3, $4, $5, 'NAD', $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, monthly_price = EXCLUDED.monthly_price, annual_price = EXCLUDED.annual_price,
         trial_days = EXCLUDED.trial_days, most_popular = EXCLUDED.most_popular,
         contact_sales = EXCLUDED.contact_sales, sort_order = EXCLUDED.sort_order, updated_at = now()`,
      [p.id, p.name, p.slug, p.monthlyPrice, p.annualPrice, p.trialDays, !!p.mostPopular, !!p.contactSales, p.sortOrder]
    );
    for (const [key, value] of Object.entries(p.features)) {
      await pool.query(
        `INSERT INTO plan_features (plan_id, feature_key, feature_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_value = EXCLUDED.feature_value, updated_at = now()`,
        [p.id, key, value]
      );
    }
  }
}

// ---- Plans (read) ----

export async function listActivePlans() {
  const { rows: plans } = await pool.query('SELECT * FROM plans WHERE active = true ORDER BY sort_order ASC');
  const { rows: features } = await pool.query('SELECT * FROM plan_features');
  const byPlan = {};
  for (const f of features) {
    (byPlan[f.plan_id] ||= {})[f.feature_key] = f.feature_value;
  }
  return plans.map(p => ({ ...p, features: byPlan[p.id] || {} }));
}

export async function getPlan(planId) {
  const { rows } = await pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
  return rows[0] || null;
}

// ---- Subscriptions ----

export async function getSubscriptionByFarm(farmId) {
  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE farm_id = $1', [farmId]);
  return rows[0] || null;
}

// Called once, right after a farm is created — every new farm starts on a
// 30-day trial of the Standard plan, per the trial policy.
export async function startTrialSubscription(farmId, { id }) {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO subscriptions
       (id, farm_id, plan_id, status, billing_cycle, provider, trial_start, trial_end, current_period_start, current_period_end)
     VALUES ($1, $2, 'standard', 'trialing', 'monthly', 'manual', $3, $4, $3, $4)`,
    [id, farmId, now.toISOString(), trialEnd.toISOString()]
  );
  return { trialEnd };
}

// The core trial-expiry rule, checked lazily whenever a subscription is
// read (see getEffectivePlan below) rather than requiring a cron job to
// exist for correctness — a farm's plan is never stale by more than the
// time until its next API call. A dedicated scheduled sweep (see
// expireOverdueTrials) is also provided for farms that go quiet, e.g. for
// admin reporting, but isn't required for correctness.
async function maybeExpireTrial(sub) {
  if (sub.status !== 'trialing') return sub;
  if (new Date(sub.trial_end) > new Date()) return sub;
  // Trial period is over and nothing upgraded it to 'active' (that would
  // happen via a real payment webhook) — downgrade to Free. Farm data is
  // never touched here, only which plan future actions are checked against.
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = 'expired', updated_at = now() WHERE id = $1 RETURNING *`,
    [sub.id]
  );
  return rows[0];
}

// Days a farm keeps its paid plan after the paid period ends, while the
// customer sorts out the renewal. After this it drops to Free (nothing is
// deleted). Change it here and the admin totals follow.
export const GRACE_DAYS = 7;

// A paid subscription does not run forever. Once the period you were paid
// for is over it becomes 'past_due' (still has its plan, and the app shows
// "payment overdue"); once the grace days are also over it becomes 'expired'
// and the farm is on Free. Paying again (see accounting.recordPayment)
// reactivates it. Like trial expiry, this is checked lazily on read.
async function maybeLapseSubscription(sub) {
  if (!['active', 'past_due'].includes(sub.status) || !sub.current_period_end) return sub;
  const end = new Date(sub.current_period_end).getTime();
  const now = Date.now();
  let next = null;
  if (now > end + GRACE_DAYS * 86400000) next = 'expired';
  else if (now > end && sub.status === 'active') next = 'past_due';
  if (!next) return sub;
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [sub.id, next]
  );
  return rows[0];
}

/**
 * The one function the rest of the app should call to find out what a
 * farm is currently entitled to. Always returns a usable plan — if a farm
 * somehow has no subscription row (shouldn't happen post-registration, but
 * defensive), it fails open to Free rather than throwing, so a billing
 * hiccup never locks a farmer out of their own data.
 */
export async function getEffectivePlan(farmId) {
  let sub = await getSubscriptionByFarm(farmId);
  if (!sub) {
    const free = await getPlan('free');
    return { subscription: null, plan: free, features: await planFeatureMap('free') };
  }
  sub = await maybeExpireTrial(sub);
  sub = await maybeLapseSubscription(sub);
  const effectivePlanId = ['trialing', 'active', 'past_due'].includes(sub.status) ? sub.plan_id : 'free';
  const plan = await getPlan(effectivePlanId);
  return { subscription: sub, plan, features: await planFeatureMap(effectivePlanId) };
}

async function planFeatureMap(planId) {
  const { rows } = await pool.query('SELECT feature_key, feature_value FROM plan_features WHERE plan_id = $1', [planId]);
  const map = {};
  for (const r of rows) map[r.feature_key] = r.feature_value;
  return map;
}

export async function hasFeature(farmId, key) {
  const { features } = await getEffectivePlan(farmId);
  return features[key] === 'true';
}

/**
 * Returns the numeric limit for a feature key, or null if unlimited (-1)
 * or not set. Use with a live count to decide whether an action is allowed
 * — see requireWithinLimit in routes/billing.js for the enforcement side.
 */
// Only 'animals' has a plan limit today (max_livestock) — mapping lives
// here, once, so resources.js (online CRUD) and sync.js (offline push)
// enforce exactly the same rule instead of two hand-maintained copies.
export const LIMITED_COLLECTIONS = { animals: 'max_livestock' };

export async function getFeatureLimit(farmId, key) {
  const { features } = await getEffectivePlan(farmId);
  const raw = features[key];
  if (raw === undefined) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null; // -1 (or garbage) means unlimited
  return n;
}

/**
 * Checks whether a farm has room for one more record under a countable
 * limit (e.g. max_livestock). `currentCount` is supplied by the caller
 * since counting differs slightly by context (REST create vs. a batch of
 * new records arriving via offline sync).
 */
export async function isWithinLimit(farmId, featureKey, currentCount) {
  const limit = await getFeatureLimit(farmId, featureKey);
  if (limit === null) return true; // unlimited
  return currentCount < limit;
}

// For a scheduled job (Render Cron Job, GitHub Actions, etc.) if you want
// trial expiry to also run proactively rather than only on next login —
// not required for correctness (see maybeExpireTrial), but keeps a
// revenue/admin report of "who's on an expired trial" accurate even for a
// farm that hasn't opened the app in a while.
export async function expireOverdueTrials() {
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = 'expired', updated_at = now()
     WHERE status = 'trialing' AND trial_end < now()
     RETURNING id, farm_id`
  );
  return rows;
}
