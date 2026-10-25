import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getMailProvider } from '../mail/providers.js';
import { welcomeEmail, invoiceEmail, receiptEmail, esc, money } from '../mail/templates.js';

const realFetch = globalThis.fetch;
let calls;
const msg = { to: 'farmer@example.com', toName: 'Farmer Joe', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi',
  from: { email: 'no-reply@orutumbo.test', name: 'Orutumbo' }, replyTo: 'help@orutumbo.test' };

beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  };
  process.env.MAIL_API_KEY = 'test-key';
});
afterEach(() => { globalThis.fetch = realFetch; delete process.env.MAIL_API_KEY; });

describe('mail providers', () => {
  test('brevo sends the documented request over HTTPS', async () => {
    await getMailProvider('brevo').send(msg);
    const c = calls[0];
    assert.equal(c.url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(c.opts.headers['api-key'], 'test-key');
    assert.deepEqual(c.body.sender, { name: 'Orutumbo', email: 'no-reply@orutumbo.test' });
    assert.deepEqual(c.body.to, [{ email: 'farmer@example.com', name: 'Farmer Joe' }]);
    assert.equal(c.body.subject, 'Hello');
    assert.equal(c.body.htmlContent, '<p>Hi</p>');
    assert.equal(c.body.textContent, 'Hi');
    assert.deepEqual(c.body.replyTo, { email: 'help@orutumbo.test' });
  });

  test('resend sends the documented request over HTTPS', async () => {
    await getMailProvider('resend').send(msg);
    const c = calls[0];
    assert.equal(c.url, 'https://api.resend.com/emails');
    assert.equal(c.opts.headers.Authorization, 'Bearer test-key');
    assert.equal(c.body.from, 'Orutumbo <no-reply@orutumbo.test>');
    assert.deepEqual(c.body.to, ['farmer@example.com']);
    assert.equal(c.body.reply_to, 'help@orutumbo.test');
  });

  test('log provider sends nothing', async () => {
    await getMailProvider('log').send(msg);
    assert.equal(calls.length, 0);
  });

  test('missing API key or sender address is reported clearly', async () => {
    delete process.env.MAIL_API_KEY;
    await assert.rejects(getMailProvider('brevo').send(msg), /MAIL_API_KEY is not set/);
    process.env.MAIL_API_KEY = 'k';
    await assert.rejects(getMailProvider('resend').send({ ...msg, from: { email: '', name: 'Orutumbo' } }), /MAIL_FROM_EMAIL is not set/);
  });

  test('a rejected API call surfaces the status and detail', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'Key not found' });
    await assert.rejects(getMailProvider('brevo').send(msg), /401.*Key not found/);
  });

  test('an unknown provider name is rejected', () => {
    assert.throws(() => getMailProvider('carrier-pigeon'), /Unknown MAIL_PROVIDER/);
  });
});

describe('email templates', () => {
  const invoice = {
    invoice_number: 'INV-000007', customer_number: 'ORU-000012', description: 'Orutumbo Standard plan, monthly subscription',
    amount: 199, due_at: '2026-11-20T10:00:00Z', bill_to: { ownerName: 'Joe', farmName: 'Farm', email: 'j@x.test' },
  };

  test('welcome email carries the customer number and trial end', () => {
    const e = welcomeEmail({ ownerName: 'Joe', farmName: 'Ondjeva Farm', customerNumber: 'ORU-000012', trialEnd: '2026-11-14T00:00:00Z', appUrl: 'https://app.test' });
    assert.match(e.subject, /ORU-000012/);
    assert.match(e.html, /ORU-000012/);
    assert.match(e.text, /ORU-000012/);
    assert.match(e.text, /14 November 2026/);
    assert.match(e.html, /https:\/\/app\.test/);
  });

  test('anything a customer typed is HTML-escaped in the email', () => {
    const e = welcomeEmail({ ownerName: '<script>alert(1)</script>', farmName: '"><img src=x onerror=alert(1)>', customerNumber: 'ORU-000001', trialEnd: '2026-11-14' });
    assert.ok(!e.html.includes('<script>'));
    assert.ok(!e.html.includes('<img'));
    assert.match(e.html, /&lt;script&gt;/);
  });

  test('invoice email shows amount, reference and bank details', () => {
    const e = invoiceEmail({ invoice, eftDetails: 'Bank: Test Bank\nAccount: 12345' });
    assert.match(e.subject, /INV-000007.*N\$199\.00/);
    assert.match(e.text, /use INV-000007 as your payment reference/);
    assert.match(e.text, /Account: 12345/);
    assert.match(invoiceEmail({ invoice }).text, /send you our banking details/);
  });

  test('receipt email states the new period end', () => {
    const e = receiptEmail({ invoice, payment: { amount: 199, received_at: '2026-10-20T10:00:00Z' }, planName: 'Standard', periodEnd: '2026-11-19T10:00:00Z' });
    assert.match(e.text, /Standard plan is active until 19 November 2026/);
  });

  test('money and esc helpers', () => {
    assert.equal(money(1990), 'N$1,990.00');
    assert.equal(esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});
