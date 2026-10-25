import { nanoid } from 'nanoid';
import { pool } from '../db.js';
import { getMailProvider } from './providers.js';

export async function initMailSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      farm_id TEXT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      template TEXT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Sends one email and records the outcome in email_log. Never throws: a mail
// problem must not break the signup or payment that triggered it.
export async function sendMail({ to, toName, subject, html, text, template, farmId }) {
  const providerName = (process.env.MAIL_PROVIDER || 'log').toLowerCase();
  let status = providerName === 'log' ? 'logged' : 'sent';
  let error = null;
  try {
    await getMailProvider(providerName).send({
      to, toName, subject, html, text,
      from: { email: process.env.MAIL_FROM_EMAIL || '', name: process.env.MAIL_FROM_NAME || 'Orutumbo' },
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });
  } catch (err) {
    status = 'failed';
    error = String(err.message || err).slice(0, 500);
    console.error(`[mail] ${template || 'email'} to ${to} failed: ${error}`);
  }
  try {
    await pool.query(
      `INSERT INTO email_log (id, farm_id, to_email, subject, template, provider, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [nanoid(12), farmId || null, to, subject, template || null, providerName, status, error]
    );
  } catch (err) {
    console.error('[mail] could not write email_log:', err.message);
  }
  return { ok: status !== 'failed', status };
}

// Fire-and-forget, for request handlers that must not wait on email.
export function queueMail(options) {
  sendMail(options).catch((err) => console.error('[mail] unexpected error:', err));
}
