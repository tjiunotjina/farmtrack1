import { nanoid } from 'nanoid';
import { pool } from './db.js';
import { GRACE_DAYS } from './billing.js';

export class AccountingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const PERIOD_DAYS = { monthly: 30, annual: 365 };
const cents = (n) => Math.round(Number(n) * 100);
const DAY = 24 * 60 * 60 * 1000;

// NUMERIC columns come back from pg as strings; the API always returns numbers.
const shapeInvoice = (r) => r && { ...r, amount: Number(r.amount) };
const shapePayment = (r) => r && { ...r, amount: Number(r.amount) };

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw err;
  } finally {
    client.release();
  }
}

// ---- Schema ----

const CUSTOMER_NO_SQL = `'ORU-' || lpad(nextval('customer_number_seq')::text, 6, '0')`;

export async function initAccountingSchema() {
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1`);
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1`);
  await pool.query(`ALTER TABLE farms ADD COLUMN IF NOT EXISTS customer_number TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_farms_customer_number ON farms (customer_number)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      farm_id TEXT NOT NULL REFERENCES farms(id),
      customer_number TEXT NOT NULL,
      plan_id TEXT,
      plan_name TEXT,
      billing_cycle TEXT,
      period_days INTEGER,
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'NAD',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','void')),
      bill_to JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT NOT NULL DEFAULT 'customer',
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      due_at TIMESTAMPTZ NOT NULL,
      paid_at TIMESTAMPTZ,
      void_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_farm ON invoices (farm_id, issued_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      farm_id TEXT NOT NULL REFERENCES farms(id),
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'NAD',
      method TEXT NOT NULL,
      reference TEXT,
      received_at TIMESTAMPTZ NOT NULL,
      recorded_by TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_farm ON payments (farm_id, received_at DESC)`);

  // Farms that existed before customer numbers did get one now, oldest first,
  // so numbers follow signup order. One at a time on purpose: nextval() order
  // inside a single UPDATE...FROM is not guaranteed to follow the sort.
  const { rows } = await pool.query(`SELECT id FROM farms WHERE customer_number IS NULL ORDER BY created_at, id`);
  for (const r of rows) await assignCustomerNumber(r.id);
}

// ---- Customer numbers ----

// Numbers come from a database sequence, so two signups at the same instant
// can never receive the same one. Safe to call twice for the same farm.
export async function assignCustomerNumber(farmId) {
  const { rows } = await pool.query(
    `UPDATE farms SET customer_number = ${CUSTOMER_NO_SQL} WHERE id = $1 AND customer_number IS NULL RETURNING customer_number`,
    [farmId]
  );
  if (rows[0]) return rows[0].customer_number;
  const existing = await pool.query(`SELECT customer_number FROM farms WHERE id = $1`, [farmId]);
  return existing.rows[0]?.customer_number || null;
}

// ---- Invoices ----

/**
 * Creates an invoice. For a customer choosing a plan, clicking the same plan
 * twice returns the same open invoice instead of creating a duplicate, and
 * choosing a different plan voids the earlier self-created one. Invoices an
 * admin created are never voided by a customer's clicks.
 */
export async function createInvoice({ farmId, plan = null, billingCycle = null, amount = null, description = null, dueDays = 7, createdBy = 'customer' }) {
  if (plan && !PERIOD_DAYS[billingCycle]) throw new AccountingError(400, 'billingCycle must be monthly or annual');
  const price = amount != null ? Number(amount) : plan ? Number(billingCycle === 'annual' ? plan.annual_price : plan.monthly_price) : NaN;
  if (!Number.isFinite(price) || price <= 0) throw new AccountingError(400, 'Invoice amount must be greater than zero');
  if (!plan && !description) throw new AccountingError(400, 'A description is required when there is no plan');
  const desc = description || `Orutumbo ${plan.name} plan, ${billingCycle} subscription`;

  return withTx(async (c) => {
    // Locking the farm row serialises invoice creation per farm, so a
    // double-tap on "Choose this plan" cannot create two invoices.
    const f = await c.query(
      `SELECT f.*, (SELECT email FROM users WHERE farm_id = f.id ORDER BY created_at LIMIT 1) AS owner_email
         FROM farms f WHERE f.id = $1 FOR UPDATE`, [farmId]);
    const farm = f.rows[0];
    if (!farm) throw new AccountingError(404, 'Customer not found');
    if (!farm.customer_number) {
      const n = await c.query(`UPDATE farms SET customer_number = ${CUSTOMER_NO_SQL} WHERE id = $1 RETURNING customer_number`, [farmId]);
      farm.customer_number = n.rows[0].customer_number;
    }

    if (createdBy === 'customer' && plan) {
      const open = await c.query(`SELECT * FROM invoices WHERE farm_id = $1 AND status = 'open' AND created_by = 'customer' ORDER BY issued_at DESC`, [farmId]);
      const same = open.rows.find((i) => i.plan_id === plan.id && i.billing_cycle === billingCycle && cents(i.amount) === cents(price));
      if (same) return { invoice: shapeInvoice(same), created: false };
      for (const i of open.rows) {
        await c.query(`UPDATE invoices SET status = 'void', void_reason = 'Superseded by a new plan selection', updated_at = now() WHERE id = $1`, [i.id]);
      }
    }

    const billTo = { farmName: farm.name, ownerName: farm.owner_name, email: farm.owner_email, village: farm.village || '' };
    const ins = await c.query(
      `INSERT INTO invoices (id, invoice_number, farm_id, customer_number, plan_id, plan_name, billing_cycle, period_days, description, amount, bill_to, created_by, due_at)
       VALUES ($1, 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now() + ($12 || ' days')::interval)
       RETURNING *`,
      [nanoid(10), farmId, farm.customer_number, plan?.id || null, plan?.name || null, plan ? billingCycle : null,
       plan ? PERIOD_DAYS[billingCycle] : null, desc, price.toFixed(2), JSON.stringify(billTo), createdBy, String(dueDays)]
    );
    return { invoice: shapeInvoice(ins.rows[0]), created: true };
  });
}

export async function voidInvoice(invoiceId, reason) {
  const { rows } = await pool.query(
    `UPDATE invoices SET status = 'void', void_reason = $2, updated_at = now() WHERE id = $1 AND status = 'open' RETURNING *`,
    [invoiceId, reason || 'Voided by admin']
  );
  if (rows[0]) return shapeInvoice(rows[0]);
  const exists = await pool.query(`SELECT status FROM invoices WHERE id = $1`, [invoiceId]);
  if (!exists.rows[0]) throw new AccountingError(404, 'Invoice not found');
  throw new AccountingError(409, `Invoice is already ${exists.rows[0].status}`);
}

/**
 * Records a payment against an open invoice and, if the invoice was for a
 * plan, activates that plan. Runs in one transaction with the invoice row
 * locked, so the same payment cannot be recorded twice. The amount must
 * equal the invoice total; partial payments are not supported yet.
 */
export async function recordPayment({ invoiceId, amount, method, reference, receivedAt, recordedBy = 'admin' }) {
  if (!method) throw new AccountingError(400, 'A payment method is required');
  const received = receivedAt ? new Date(receivedAt) : new Date();
  if (Number.isNaN(received.getTime())) throw new AccountingError(400, 'receivedAt is not a valid date');

  return withTx(async (c) => {
    const inv = (await c.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [invoiceId])).rows[0];
    if (!inv) throw new AccountingError(404, 'Invoice not found');
    if (inv.status !== 'open') throw new AccountingError(409, `Invoice is already ${inv.status}`);
    if (cents(amount) !== cents(inv.amount)) {
      throw new AccountingError(400, `Payment amount must equal the invoice total (N$${Number(inv.amount).toFixed(2)}). Partial payments are not supported yet.`);
    }

    const pay = (await c.query(
      `INSERT INTO payments (id, invoice_id, farm_id, amount, currency, method, reference, received_at, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [nanoid(10), inv.id, inv.farm_id, Number(inv.amount).toFixed(2), inv.currency, method, reference || null, received.toISOString(), recordedBy]
    )).rows[0];
    const paidInv = (await c.query(`UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = $1 RETURNING *`, [inv.id])).rows[0];

    let subscription = null;
    if (inv.plan_id) {
      const now = new Date();
      const sub = (await c.query(`SELECT * FROM subscriptions WHERE farm_id = $1 FOR UPDATE`, [inv.farm_id])).rows[0];
      // Renewing the same plan while it is still running adds the new period
      // to the end of the current one, so paying early never loses days.
      const renewing = sub && sub.status === 'active' && sub.plan_id === inv.plan_id && sub.current_period_end && new Date(sub.current_period_end) > now;
      const start = renewing ? new Date(sub.current_period_end) : now;
      const end = new Date(start.getTime() + inv.period_days * DAY);
      if (!sub) {
        subscription = (await c.query(
          `INSERT INTO subscriptions (id, farm_id, plan_id, status, billing_cycle, provider, current_period_start, current_period_end, next_billing_date)
           VALUES ($1, $2, $3, 'active', $4, 'manual', $5, $6, $6) RETURNING *`,
          [nanoid(10), inv.farm_id, inv.plan_id, inv.billing_cycle, now.toISOString(), end.toISOString()]
        )).rows[0];
      } else {
        subscription = (await c.query(
          `UPDATE subscriptions SET status = 'active', plan_id = $2, billing_cycle = $3,
             current_period_start = $4, current_period_end = $5, next_billing_date = $5,
             trial_end = CASE WHEN status = 'trialing' THEN LEAST(COALESCE(trial_end, $6), $6) ELSE trial_end END,
             updated_at = now()
           WHERE farm_id = $1 RETURNING *`,
          [inv.farm_id, inv.plan_id, inv.billing_cycle, (renewing ? sub.current_period_start : now).toISOString(), end.toISOString(), now.toISOString()]
        )).rows[0];
      }
    }
    return { invoice: shapeInvoice(paidInv), payment: shapePayment(pay), subscription };
  });
}

// ---- Reads for the client area (always scoped to one farm) ----

export async function listInvoicesForFarm(farmId) {
  const { rows } = await pool.query(`SELECT * FROM invoices WHERE farm_id = $1 ORDER BY issued_at DESC, invoice_number DESC`, [farmId]);
  return rows.map(shapeInvoice);
}

export async function getInvoiceForFarm(farmId, invoiceId) {
  const { rows } = await pool.query(`SELECT * FROM invoices WHERE id = $1 AND farm_id = $2`, [invoiceId, farmId]);
  return shapeInvoice(rows[0]) || null;
}

export async function listPaymentsForFarm(farmId) {
  const { rows } = await pool.query(
    `SELECT p.*, i.invoice_number FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE p.farm_id = $1 ORDER BY p.received_at DESC`, [farmId]);
  return rows.map(shapePayment);
}

export async function balanceForFarm(farmId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS outstanding, COUNT(*) AS open_invoices
       FROM invoices WHERE farm_id = $1 AND status = 'open'`, [farmId]);
  return { outstanding: Number(rows[0].outstanding), openInvoices: Number(rows[0].open_invoices) };
}

// ---- Reads for the admin (all farms) ----

// The status a customer actually has right now, mirroring the lazy rules in
// billing.js, so admin reports are right even for a farm that has not opened
// the app since its trial or paid period ended.
function effectiveStatus(s) {
  const now = Date.now();
  if (s.status === 'trialing') return new Date(s.trial_end) < now ? 'expired' : 'trialing';
  if ((s.status === 'active' || s.status === 'past_due') && s.current_period_end) {
    const end = new Date(s.current_period_end).getTime();
    if (now > end + GRACE_DAYS * 86400000) return 'expired';
    if (now > end) return 'past_due';
  }
  return s.status;
}

export async function listCustomers() {
  const { rows } = await pool.query(`
    SELECT f.id, f.customer_number, f.name, f.owner_name, f.village, f.created_at,
           (SELECT email FROM users WHERE farm_id = f.id ORDER BY created_at LIMIT 1) AS email,
           s.status AS sub_status, s.plan_id, s.billing_cycle, s.trial_end, s.current_period_end,
           COALESCE((SELECT SUM(amount) FROM invoices i WHERE i.farm_id = f.id AND i.status = 'open'), 0) AS outstanding,
           COALESCE((SELECT SUM(amount) FROM payments p WHERE p.farm_id = f.id), 0) AS paid_total
      FROM farms f LEFT JOIN subscriptions s ON s.farm_id = f.id
     ORDER BY f.created_at DESC`);
  return rows.map((r) => ({
    ...r,
    sub_status: r.sub_status ? effectiveStatus({ status: r.sub_status, trial_end: r.trial_end, current_period_end: r.current_period_end }) : null,
    outstanding: Number(r.outstanding),
    paid_total: Number(r.paid_total),
  }));
}

export async function listAllInvoices({ status } = {}) {
  const params = [];
  let where = '';
  if (status) { params.push(status); where = 'WHERE i.status = $1'; }
  const { rows } = await pool.query(
    `SELECT i.*, f.name AS farm_name FROM invoices i JOIN farms f ON f.id = i.farm_id ${where}
      ORDER BY i.issued_at DESC, i.invoice_number DESC LIMIT 500`, params);
  return rows.map(shapeInvoice);
}

export async function listAllPayments() {
  const { rows } = await pool.query(
    `SELECT p.*, i.invoice_number, f.customer_number, f.name AS farm_name
       FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN farms f ON f.id = p.farm_id
      ORDER BY p.received_at DESC LIMIT 500`);
  return rows.map(shapePayment);
}

export async function listEmailLog() {
  const { rows } = await pool.query(`SELECT * FROM email_log ORDER BY created_at DESC LIMIT 100`);
  return rows;
}

export async function findFarmByCustomerNumber(customerNumber) {
  const { rows } = await pool.query(`SELECT id FROM farms WHERE customer_number = $1`, [customerNumber]);
  return rows[0]?.id || null;
}

export async function revenueSummary() {
  const totals = (await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM farms) AS customers,
      (SELECT COALESCE(SUM(amount), 0) FROM payments) AS collected_total,
      (SELECT COALESCE(SUM(amount), 0) FROM payments
         WHERE received_at >= date_trunc('month', now() AT TIME ZONE 'Africa/Windhoek') AT TIME ZONE 'Africa/Windhoek') AS collected_month,
      (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'open') AS outstanding,
      (SELECT COUNT(*) FROM invoices WHERE status = 'open') AS open_invoices,
      (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'open' AND due_at < now()) AS overdue,
      (SELECT COUNT(*) FROM invoices WHERE status = 'open' AND due_at < now()) AS overdue_count`)).rows[0];

  const subs = (await pool.query(`
    SELECT s.status, s.trial_end, s.current_period_end, s.billing_cycle, s.plan_id, p.monthly_price, p.annual_price
      FROM subscriptions s JOIN plans p ON p.id = s.plan_id`)).rows;
  const byStatus = {};
  const activeByPlan = {};
  let mrr = 0;
  for (const s of subs) {
    const st = effectiveStatus(s);
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (st === 'active') {
      activeByPlan[s.plan_id] = (activeByPlan[s.plan_id] || 0) + 1;
      mrr += s.billing_cycle === 'annual' ? Number(s.annual_price) / 12 : Number(s.monthly_price);
    }
  }
  return {
    customers: Number(totals.customers),
    subscriptions: byStatus,
    activeByPlan,
    mrr: Math.round(mrr * 100) / 100,
    collectedThisMonth: Number(totals.collected_month),
    collectedTotal: Number(totals.collected_total),
    outstanding: Number(totals.outstanding),
    openInvoices: Number(totals.open_invoices),
    overdue: Number(totals.overdue),
    overdueInvoices: Number(totals.overdue_count),
    currency: 'NAD',
  };
}

// ---- Shared helpers ----

export function accountingErrorHandler(err, res, next) {
  if (err instanceof AccountingError) return res.status(err.status).json({ error: err.message });
  return next(err);
}

// Printed on invoices and shown in the client area. All optional: anything
// you leave unset in the environment is simply left off.
export function companyInfo() {
  return {
    name: process.env.COMPANY_NAME || 'Tjiunotjina Mureti Tech',
    address: process.env.COMPANY_ADDRESS || '',
    vatNumber: process.env.COMPANY_VAT_NUMBER || '',
    supportEmail: process.env.SUPPORT_EMAIL || '',
    eftDetails: process.env.EFT_DETAILS || '',
  };
}
