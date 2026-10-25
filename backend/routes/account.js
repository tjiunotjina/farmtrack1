import { Router } from 'express';
import { pool, getFarm } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getEffectivePlan } from '../billing.js';
import {
  listInvoicesForFarm, getInvoiceForFarm, listPaymentsForFarm, balanceForFarm, companyInfo,
} from '../accounting.js';

// The client area. Every query here is scoped to req.user.farmId, which comes
// from the verified login token. Nothing trusts a farm id from the URL, so a
// customer cannot read another customer's invoices by guessing ids.
const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const farm = await getFarm(farmId);
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.userId]);
    const { subscription, plan } = await getEffectivePlan(farmId);
    const trialDaysRemaining = subscription?.status === 'trialing'
      ? Math.max(0, Math.ceil((new Date(subscription.trial_end) - new Date()) / 86400000))
      : null;
    res.json({
      customerNumber: farm.customer_number,
      farm: { name: farm.name, village: farm.village, ownerName: farm.owner_name, stockBrand: farm.stock_brand, memberSince: farm.created_at },
      email: rows[0]?.email || req.user.email,
      plan: { name: plan.name, slug: plan.slug },
      subscription: subscription && {
        status: subscription.status,
        billingCycle: subscription.billing_cycle,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end,
      },
      trialDaysRemaining,
      balance: await balanceForFarm(farmId),
      company: companyInfo(),
    });
  } catch (err) { next(err); }
});

router.get('/invoices', async (req, res, next) => {
  try { res.json({ invoices: await listInvoicesForFarm(req.user.farmId) }); } catch (err) { next(err); }
});

router.get('/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await getInvoiceForFarm(req.user.farmId, req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice, company: companyInfo() });
  } catch (err) { next(err); }
});

router.get('/payments', async (req, res, next) => {
  try { res.json({ payments: await listPaymentsForFarm(req.user.farmId) }); } catch (err) { next(err); }
});

export default router;
