import { Router } from 'express';
import { nanoid } from 'nanoid';
import { pool } from '../db.js';
import {
  listActivePlans, getPlan, getEffectivePlan, getSubscriptionByFarm,
} from '../billing.js';
import { getProvider } from '../payments/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public — a pricing page doesn't require login.
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await listActivePlans();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// The farm's current subscription, effective plan (after trial-expiry
// resolution), and entitlements — the frontend renders trial countdowns,
// paywalls, and the billing screen entirely from this one response.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { subscription, plan, features } = await getEffectivePlan(req.user.farmId);
    const trialDaysRemaining = subscription?.status === 'trialing'
      ? Math.max(0, Math.ceil((new Date(subscription.trial_end) - new Date()) / 86400000))
      : null;
    res.json({ subscription, plan, features, trialDaysRemaining });
  } catch (err) {
    next(err);
  }
});

// Starts (or restarts) a checkout for a plan. With only the 'manual'
// provider registered today, this returns payment instructions rather
// than a redirect URL — see payments/manual.js. Swapping in a real
// provider later changes what this response looks like, not this route.
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const { planSlug, billingCycle } = req.body;
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({ error: 'billingCycle must be monthly or annual' });
    }

    const { rows } = await pool.query('SELECT * FROM plans WHERE slug = $1 AND active = true', [planSlug]);
    const plan = rows[0];
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.contact_sales) return res.status(400).json({ error: 'This plan requires contacting sales, not self-serve checkout' });

    let sub = await getSubscriptionByFarm(req.user.farmId);
    const provider = getProvider(sub?.provider || 'manual');

    if (!sub) {
      const id = nanoid(10);
      await pool.query(
        `INSERT INTO subscriptions (id, farm_id, plan_id, status, billing_cycle, provider)
         VALUES ($1, $2, $3, 'pending', $4, 'manual')`,
        [id, req.user.farmId, plan.id, billingCycle]
      );
      sub = await getSubscriptionByFarm(req.user.farmId);
    } else {
      await pool.query(
        `UPDATE subscriptions SET plan_id = $2, billing_cycle = $3, status = 'pending', updated_at = now() WHERE farm_id = $1`,
        [req.user.farmId, plan.id, billingCycle]
      );
    }

    const result = await provider.createCheckout({ farm: req.user, plan, billingCycle, subscriptionId: sub.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/cancel', requireAuth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const sub = await getSubscriptionByFarm(req.user.farmId);
    if (!sub) return res.status(404).json({ error: 'No subscription found' });

    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $2, updated_at = now() WHERE farm_id = $1`,
      [req.user.farmId, reason || null]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Temporary stand-in for real payment confirmation until a gateway is
// connected: gated by a shared secret (ADMIN_SECRET env var) rather than a
// full admin-user system, which doesn't exist yet. Marks a farm's pending
// subscription active for one billing period from today. This is meant to
// be deleted (or left unused) once a real provider's webhook handles this
// automatically — see the webhook route below for where that will land.
router.post('/admin/mark-paid', async (req, res, next) => {
  try {
    const { adminSecret, farmId, periodDays } = req.body;
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Invalid admin secret' });
    }
    const sub = await getSubscriptionByFarm(farmId);
    if (!sub) return res.status(404).json({ error: 'No subscription found for that farm' });

    const now = new Date();
    const periodEnd = new Date(now.getTime() + (periodDays || 30) * 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE subscriptions SET status = 'active', current_period_start = $2, current_period_end = $3,
         next_billing_date = $3, trial_end = LEAST(COALESCE(trial_end, $2), $2), updated_at = now()
       WHERE farm_id = $1`,
      [farmId, now.toISOString(), periodEnd.toISOString()]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Dispatches an incoming webhook to whichever provider it claims to be
// from. Only 'manual' is registered today, which always rejects — this
// exists so adding a real provider later is "write the adapter, register
// it, done," not "design the webhook route from scratch under pressure."
router.post('/webhooks/:provider', async (req, res, next) => {
  try {
    const provider = getProvider(req.params.provider);
    if (!provider.verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    const event = provider.parseWebhookEvent(req);

    const { rows } = await pool.query('SELECT * FROM subscriptions WHERE provider_subscription_id = $1', [event.providerSubscriptionId]);
    const sub = rows[0];
    if (!sub) return res.status(404).json({ error: 'No matching subscription' });

    if (event.type === 'payment_succeeded') {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + (sub.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000);
      await pool.query(
        `UPDATE subscriptions SET status = 'active', current_period_start = $2, current_period_end = $3, next_billing_date = $3, updated_at = now() WHERE id = $1`,
        [sub.id, now.toISOString(), periodEnd.toISOString()]
      );
    } else if (event.type === 'payment_failed') {
      await pool.query(`UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE id = $1`, [sub.id]);
    } else if (event.type === 'subscription_cancelled') {
      await pool.query(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1`, [sub.id]);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
