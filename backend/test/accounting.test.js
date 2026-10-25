// Integration tests against a real Postgres. They create their own farms with
// random emails and never delete anything, so point TEST_DATABASE_URL at a
// throwaway database, never at production:
//   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/orutumbo_test npm test
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const DB = process.env.TEST_DATABASE_URL;
const skip = DB ? false : 'TEST_DATABASE_URL is not set';
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = 'admin-secret-for-tests';
const servers = [];

function startServer(port, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['server.js'], {
      cwd: backendDir,
      env: {
        ...process.env, DATABASE_URL: DB, JWT_SECRET: 'test-jwt', ADMIN_SECRET: ADMIN, MAIL_PROVIDER: 'log',
        APP_URL: 'https://app.test', EFT_DETAILS: 'Bank: Test Bank\nAccount: 12345', PORT: String(port), ...env,
      },
    });
    let out = '';
    const timer = setTimeout(() => reject(new Error('server did not start: ' + out)), 15000);
    proc.stdout.on('data', (d) => { out += d; if (out.includes('listening')) { clearTimeout(timer); resolve({ base: `http://localhost:${port}`, proc }); } });
    proc.stderr.on('data', (d) => { out += d; });
    proc.on('exit', (code) => { if (!out.includes('listening')) reject(new Error(`server exited ${code}: ${out}`)); });
    servers.push(proc);
  });
}

async function call(base, p, { method = 'GET', body, token, admin, headers = {} } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(admin ? { 'x-admin-secret': admin } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const rand = () => Math.random().toString(36).slice(2, 10);
async function register(base, name = 'Test Farm') {
  const email = `${rand()}@t.test`;
  const r = await call(base, '/api/auth/register', { method: 'POST', body: { farmName: name, ownerName: 'Test Owner', email, password: 'password123' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token, farm: r.body.farm, email };
}
async function waitFor(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 100)); }
  return null;
}
const DAY = 86400000;

describe('customer numbers, invoices, payments and the client area', { skip }, () => {
  let base;
  before(async () => { ({ base } = await startServer(4100)); });
  after(() => servers.forEach((p) => p.kill()));

  test('every signup gets a unique customer number, even when signups collide', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => register(base)));
    const numbers = results.map((r) => r.farm.customer_number);
    assert.ok(numbers.every((n) => /^ORU-\d{6}$/.test(n)), numbers.join());
    assert.equal(new Set(numbers).size, 10);
    const login = await call(base, '/api/auth/login', { method: 'POST', body: { email: results[0].email, password: 'password123' } });
    assert.equal(login.body.farm.customer_number, results[0].farm.customer_number);
  });

  test('the welcome email is sent with the customer number', async () => {
    const { email, farm } = await register(base);
    const row = await waitFor(async () => {
      const r = await call(base, '/api/admin/email-log', { admin: ADMIN });
      return r.body.emails.find((e) => e.to_email === email && e.template === 'welcome');
    });
    assert.ok(row, 'welcome email was not logged');
    assert.equal(row.status, 'logged');
    assert.ok(row.subject.includes(farm.customer_number));
  });

  test('a broken email setup never breaks signup', async () => {
    const { base: b2 } = await startServer(4101, { MAIL_PROVIDER: 'brevo', MAIL_API_KEY: '' });
    const { email, farm } = await register(b2);
    assert.match(farm.customer_number, /^ORU-\d{6}$/);
    const row = await waitFor(async () => {
      const r = await call(b2, '/api/admin/email-log', { admin: ADMIN });
      return r.body.emails.find((e) => e.to_email === email);
    });
    assert.equal(row.status, 'failed');
    assert.match(row.error, /MAIL_API_KEY/);
  });

  test('choosing a plan creates an invoice and leaves the trial untouched', async () => {
    const { token } = await register(base);
    const c = await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'standard', billingCycle: 'monthly' } });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.invoice.amount, 199);
    assert.equal(typeof c.body.invoice.amount, 'number');
    assert.equal(c.body.invoice.status, 'open');
    assert.match(c.body.invoice.invoice_number, /^INV-\d{6}$/);
    assert.ok(c.body.instructions.includes(c.body.invoice.invoice_number));
    assert.ok(c.body.instructions.includes('Test Bank'));

    const status = await call(base, '/api/billing', { token });
    assert.equal(status.body.subscription.status, 'trialing', 'trial must survive choosing a plan');
    assert.equal(status.body.plan.name, 'Standard');

    const again = await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'standard', billingCycle: 'monthly' } });
    assert.equal(again.body.invoice.id, c.body.invoice.id, 'double click must not create a second invoice');
  });

  test('choosing a different plan voids the earlier self-created invoice', async () => {
    const { token } = await register(base);
    const a = await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'standard', billingCycle: 'monthly' } });
    const b = await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'professional', billingCycle: 'annual' } });
    assert.equal(b.body.invoice.amount, 3990);
    const list = await call(base, '/api/account/invoices', { token });
    const byId = Object.fromEntries(list.body.invoices.map((i) => [i.id, i.status]));
    assert.equal(byId[a.body.invoice.id], 'void');
    assert.equal(byId[b.body.invoice.id], 'open');
  });

  test('free and contact-sales plans cannot be invoiced', async () => {
    const { token } = await register(base);
    assert.equal((await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'free', billingCycle: 'monthly' } })).status, 400);
    assert.equal((await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'enterprise', billingCycle: 'monthly' } })).status, 400);
  });

  test('a customer can never see another customer\'s invoices', async () => {
    const a = await register(base);
    const b = await register(base);
    const inv = (await call(base, '/api/billing/checkout', { method: 'POST', token: a.token, body: { planSlug: 'basic', billingCycle: 'monthly' } })).body.invoice;
    assert.equal((await call(base, `/api/account/invoices/${inv.id}`, { token: b.token })).status, 404);
    assert.equal((await call(base, '/api/account/invoices', { token: b.token })).body.invoices.length, 0);
    assert.equal((await call(base, `/api/account/invoices/${inv.id}`, { token: a.token })).status, 200);
    assert.equal((await call(base, '/api/admin/summary', { token: a.token })).status, 401, 'a customer login is not admin access');
  });

  test('admin access needs the secret, and guessing is rate limited', async () => {
    const ip = { 'X-Forwarded-For': '203.0.113.77' };
    assert.equal((await call(base, '/api/admin/summary')).status, 401);
    assert.equal((await call(base, '/api/admin/summary', { admin: ADMIN })).status, 200);
    for (let i = 0; i < 10; i++) assert.equal((await call(base, '/api/admin/summary', { admin: 'wrong' + i, headers: ip })).status, 401);
    assert.equal((await call(base, '/api/admin/summary', { admin: 'wrong-again', headers: ip })).status, 429);
    assert.equal((await call(base, '/api/admin/summary', { admin: ADMIN, headers: ip })).status, 429, 'lockout holds even for the right secret');
    assert.equal((await call(base, '/api/admin/summary', { admin: ADMIN })).status, 200, 'other addresses are unaffected');
  });

  test('recording a payment activates the plan and emails a receipt', async () => {
    const { token, email } = await register(base);
    const inv = (await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'professional', billingCycle: 'annual' } })).body.invoice;
    const pay = (body) => call(base, `/api/admin/invoices/${inv.id}/payments`, { method: 'POST', admin: ADMIN, body });

    assert.equal((await pay({ amount: 100, method: 'eft' })).status, 400, 'wrong amount must be rejected');
    assert.equal((await pay({ amount: 3990 })).status, 400, 'method is required');
    const ok = await pay({ amount: 3990, method: 'EFT', reference: 'FNB-9981' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.invoice.status, 'paid');
    assert.equal(ok.body.payment.amount, 3990);
    assert.equal(ok.body.payment.method, 'eft');

    const status = await call(base, '/api/billing', { token });
    assert.equal(status.body.subscription.status, 'active');
    assert.equal(status.body.plan.name, 'Professional');
    const end = new Date(status.body.subscription.current_period_end).getTime();
    assert.ok(Math.abs(end - (Date.now() + 365 * DAY)) < DAY, 'annual period is about 365 days');

    const payments = await call(base, '/api/account/payments', { token });
    assert.equal(payments.body.payments.length, 1);
    assert.equal(payments.body.payments[0].invoice_number, inv.invoice_number);

    assert.equal((await pay({ amount: 3990, method: 'eft' })).status, 409, 'the same invoice cannot be paid twice');
    const receipt = await waitFor(async () => (await call(base, '/api/admin/email-log', { admin: ADMIN })).body.emails.find((e) => e.to_email === email && e.template === 'receipt'));
    assert.ok(receipt, 'receipt email was not logged');
  });

  test('renewing the same plan early adds to the end of the current period', async () => {
    const { token } = await register(base);
    const payNext = async () => {
      const inv = (await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'standard', billingCycle: 'monthly' } })).body.invoice;
      const r = await call(base, `/api/admin/invoices/${inv.id}/payments`, { method: 'POST', admin: ADMIN, body: { amount: 199, method: 'eft' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return new Date(r.body.subscription.current_period_end).getTime();
    };
    const first = await payNext();
    const second = await payNext();
    assert.ok(Math.abs(second - first - 30 * DAY) < 1000, `expected +30 days, got ${(second - first) / DAY}`);
  });

  test('a paid plan lapses after its period: overdue first, Free after the grace days, and paying again restores it', async () => {
    const { token, farm } = await register(base);
    const farmId = farm.id;
    const pool = new pg.Pool({ connectionString: DB });
    const payStandard = async () => {
      const inv = (await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'standard', billingCycle: 'monthly' } })).body.invoice;
      const r = await call(base, `/api/admin/invoices/${inv.id}/payments`, { method: 'POST', admin: ADMIN, body: { amount: 199, method: 'eft' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    };
    const endedDaysAgo = (d) => pool.query(`UPDATE subscriptions SET current_period_end = now() - ($2 || ' days')::interval WHERE farm_id = $1`, [farmId, String(d)]);
    const state = async () => { const b = (await call(base, '/api/billing', { token })).body; return `${b.subscription.status}/${b.plan.name}`; };

    await payStandard();
    assert.equal(await state(), 'active/Standard');
    await endedDaysAgo(1);
    assert.equal(await state(), 'past_due/Standard', 'just after the period ends the farm keeps its plan but is marked overdue');
    await endedDaysAgo(8);
    assert.equal(await state(), 'expired/Free', 'after the grace days the farm is on Free');
    await payStandard();
    assert.equal(await state(), 'active/Standard', 'paying again reactivates the plan');
    const end = new Date((await call(base, '/api/billing', { token })).body.subscription.current_period_end).getTime();
    assert.ok(Math.abs(end - (Date.now() + 30 * DAY)) < DAY, 'the new period starts from the payment, not from the old lapsed date');

    await endedDaysAgo(8);
    const customers = (await call(base, '/api/admin/customers', { admin: ADMIN })).body.customers;
    assert.equal(customers.find((c) => c.id === farmId).sub_status, 'expired', 'admin reports show the lapsed status even before the customer opens the app');
    await pool.end();
  });

  test('custom admin invoices work, and a planless invoice never changes the subscription', async () => {
    const { token, farm } = await register(base);
    assert.equal((await call(base, '/api/admin/invoices', { method: 'POST', admin: ADMIN, body: { customerNumber: 'ORU-999999', description: 'x', amount: 5 } })).status, 404);
    assert.equal((await call(base, '/api/admin/invoices', { method: 'POST', admin: ADMIN, body: { customerNumber: farm.customer_number, description: 'x', amount: 0 } })).status, 400);
    assert.equal((await call(base, '/api/admin/invoices', { method: 'POST', admin: ADMIN, body: { customerNumber: farm.customer_number, amount: 50 } })).status, 400, 'description required without a plan');

    const made = await call(base, '/api/admin/invoices', { method: 'POST', admin: ADMIN, body: { customerNumber: farm.customer_number, description: 'Setup fee', amount: 500 } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal(made.body.invoice.plan_id, null);
    const paid = await call(base, `/api/admin/invoices/${made.body.invoice.id}/payments`, { method: 'POST', admin: ADMIN, body: { amount: 500, method: 'cash' } });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.subscription, null);
    const status = await call(base, '/api/billing', { token });
    assert.equal(status.body.subscription.status, 'trialing', 'a setup-fee payment must not end the trial');

    const byPlan = await call(base, '/api/admin/invoices', { method: 'POST', admin: ADMIN, body: { customerNumber: farm.customer_number, planSlug: 'basic', billingCycle: 'annual' } });
    assert.equal(byPlan.body.invoice.amount, 990, 'price is taken from the plan when no amount is given');
  });

  test('a voided invoice cannot be paid or voided again', async () => {
    const { token } = await register(base);
    const inv = (await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'basic', billingCycle: 'monthly' } })).body.invoice;
    const v = await call(base, `/api/admin/invoices/${inv.id}/void`, { method: 'POST', admin: ADMIN, body: { reason: 'Customer changed mind' } });
    assert.equal(v.body.invoice.status, 'void');
    assert.equal(v.body.invoice.void_reason, 'Customer changed mind');
    assert.equal((await call(base, `/api/admin/invoices/${inv.id}/void`, { method: 'POST', admin: ADMIN })).status, 409);
    assert.equal((await call(base, `/api/admin/invoices/${inv.id}/payments`, { method: 'POST', admin: ADMIN, body: { amount: 99, method: 'eft' } })).status, 409);
    assert.equal((await call(base, '/api/admin/invoices/nope/void', { method: 'POST', admin: ADMIN })).status, 404);
  });

  test('the client area overview reports the customer number and what is owed', async () => {
    const { token, farm } = await register(base);
    await call(base, '/api/billing/checkout', { method: 'POST', token, body: { planSlug: 'standard', billingCycle: 'monthly' } });
    const r = await call(base, '/api/account', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.customerNumber, farm.customer_number);
    assert.equal(r.body.balance.outstanding, 199);
    assert.equal(r.body.balance.openInvoices, 1);
    assert.equal(r.body.subscription.status, 'trialing');
    assert.ok(r.body.trialDaysRemaining >= 29);
    assert.equal(r.body.company.eftDetails, 'Bank: Test Bank\nAccount: 12345');
    assert.equal((await call(base, '/api/account')).status, 401);
  });

  test('admin totals match the underlying payments and invoices', async () => {
    const { farm } = await register(base);
    await call(base, '/api/admin/invoices', { method: 'POST', admin: ADMIN, body: { customerNumber: farm.customer_number, description: 'Overdue test', amount: 10, dueDays: 0 } });
    const [sum, pays, open, customers] = await Promise.all([
      call(base, '/api/admin/summary', { admin: ADMIN }),
      call(base, '/api/admin/payments', { admin: ADMIN }),
      call(base, '/api/admin/invoices?status=open', { admin: ADMIN }),
      call(base, '/api/admin/customers', { admin: ADMIN }),
    ]);
    const cents = (a) => Math.round(a.reduce((t, x) => t + x.amount, 0) * 100) / 100;
    assert.equal(sum.body.collectedTotal, cents(pays.body.payments));
    assert.equal(sum.body.outstanding, cents(open.body.invoices));
    assert.equal(sum.body.openInvoices, open.body.invoices.length);
    assert.ok(sum.body.overdueInvoices >= 1 && sum.body.overdue >= 10);
    assert.ok(sum.body.collectedThisMonth > 0 && sum.body.collectedThisMonth <= sum.body.collectedTotal);
    assert.ok(sum.body.mrr > 0);
    assert.ok(sum.body.subscriptions.active >= 1 && sum.body.subscriptions.trialing >= 1);
    assert.equal(sum.body.customers, customers.body.customers.length);
    assert.equal((await call(base, '/api/admin/invoices?status=bogus', { admin: ADMIN })).status, 400);
  });

  test('farms that existed before customer numbers are numbered at startup, oldest first', async () => {
    const pool = new pg.Pool({ connectionString: DB });
    const ids = ['bf' + rand(), 'bf' + rand()];
    await pool.query(`INSERT INTO farms (id, name, owner_name, created_at) VALUES ($1, 'Older', 'O', now() - interval '2 days'), ($2, 'Newer', 'N', now() - interval '1 day')`, ids);
    await startServer(4102);
    const { rows } = await pool.query(`SELECT id, customer_number FROM farms WHERE id = ANY($1)`, [ids]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.customer_number]));
    assert.match(byId[ids[0]], /^ORU-\d{6}$/);
    assert.match(byId[ids[1]], /^ORU-\d{6}$/);
    assert.ok(byId[ids[0]] < byId[ids[1]], 'older farm gets the lower number');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM farms WHERE customer_number IS NULL`)).rows[0].n, 0);
    await pool.end();
  });
});
