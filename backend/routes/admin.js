import { Router } from 'express';
import { pool } from '../db.js';
import { requireAdmin } from '../middleware/admin.js';
import { getPlan } from '../billing.js';
import {
  createInvoice, recordPayment, voidInvoice, listCustomers, listAllInvoices, listAllPayments,
  listEmailLog, revenueSummary, findFarmByCustomerNumber, accountingErrorHandler,
} from '../accounting.js';
import { queueMail } from '../mail/index.js';
import { invoiceEmail, receiptEmail } from '../mail/templates.js';

const router = Router();
router.use(requireAdmin);

router.get('/summary', async (req, res, next) => {
  try { res.json(await revenueSummary()); } catch (err) { next(err); }
});
router.get('/customers', async (req, res, next) => {
  try { res.json({ customers: await listCustomers() }); } catch (err) { next(err); }
});
router.get('/invoices', async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status && !['open', 'paid', 'void'].includes(status)) return res.status(400).json({ error: 'status must be open, paid or void' });
    res.json({ invoices: await listAllInvoices({ status }) });
  } catch (err) { next(err); }
});
router.get('/payments', async (req, res, next) => {
  try { res.json({ payments: await listAllPayments() }); } catch (err) { next(err); }
});
router.get('/email-log', async (req, res, next) => {
  try { res.json({ emails: await listEmailLog() }); } catch (err) { next(err); }
});

// Create an invoice for any customer: a plan invoice, or a custom one with
// its own amount and description (for example an Enterprise arrangement).
router.post('/invoices', async (req, res, next) => {
  try {
    const b = req.body || {};
    const farmId = b.farmId || (b.customerNumber ? await findFarmByCustomerNumber(String(b.customerNumber)) : null);
    if (!farmId) return res.status(404).json({ error: 'Customer not found. Send a customerNumber or farmId.' });

    let plan = null;
    if (b.planSlug) {
      plan = (await pool.query('SELECT * FROM plans WHERE slug = $1', [b.planSlug])).rows[0];
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
    }
    const dueDays = Number.isFinite(Number(b.dueDays)) ? Math.min(Math.max(Number(b.dueDays), 0), 90) : 7;
    const { invoice } = await createInvoice({
      farmId, plan, billingCycle: b.billingCycle || (plan ? 'monthly' : null),
      amount: b.amount ?? null, description: b.description || null, dueDays, createdBy: 'admin',
    });
    queueMail({
      to: invoice.bill_to.email, toName: invoice.bill_to.ownerName, farmId, template: 'invoice',
      ...invoiceEmail({ invoice, appUrl: process.env.APP_URL, eftDetails: process.env.EFT_DETAILS }),
    });
    res.status(201).json({ invoice });
  } catch (err) { accountingErrorHandler(err, res, next); }
});

router.post('/invoices/:id/payments', async (req, res, next) => {
  try {
    const { amount, method, reference, receivedAt } = req.body || {};
    if (typeof method !== 'string' || !method.trim() || method.length > 30) return res.status(400).json({ error: 'method is required (for example eft or cash)' });
    if (reference != null && String(reference).length > 100) return res.status(400).json({ error: 'reference is too long' });

    const result = await recordPayment({
      invoiceId: req.params.id, amount, method: method.trim().toLowerCase(), reference, receivedAt, recordedBy: 'admin',
    });
    const { invoice, payment, subscription } = result;
    const plan = subscription ? await getPlan(subscription.plan_id) : null;
    queueMail({
      to: invoice.bill_to.email, toName: invoice.bill_to.ownerName, farmId: invoice.farm_id, template: 'receipt',
      ...receiptEmail({ invoice, payment, planName: plan?.name, periodEnd: subscription?.current_period_end, appUrl: process.env.APP_URL }),
    });
    res.json(result);
  } catch (err) { accountingErrorHandler(err, res, next); }
});

router.post('/invoices/:id/void', async (req, res, next) => {
  try {
    res.json({ invoice: await voidInvoice(req.params.id, (req.body && req.body.reason) || undefined) });
  } catch (err) { accountingErrorHandler(err, res, next); }
});

export default router;
