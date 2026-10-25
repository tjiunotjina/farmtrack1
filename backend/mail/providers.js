// Email goes out over an HTTPS API, not SMTP. Render's free tier blocks all
// outbound SMTP ports (25, 465, 587), so a normal mail-server setup would
// silently time out there. HTTPS (443) is never blocked, and needs no extra
// dependency. To add a provider, write one object with a send() method here
// and register it in PROVIDERS - nothing else changes.

const TIMEOUT_MS = 15000;

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Email API responded ${res.status}: ${detail}`);
    }
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
  }
}

function need(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Default. Sends nothing; records the email in email_log so you can see what
// would have gone out. Used until a real provider is configured.
const log = {
  async send({ to, subject }) {
    console.log(`[mail:log] to=${to} subject="${subject}"`);
  },
};

const brevo = {
  async send({ to, toName, subject, html, text, from, replyTo }) {
    const apiKey = need('MAIL_API_KEY');
    if (!from.email) throw new Error('MAIL_FROM_EMAIL is not set');
    await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': apiKey }, {
      sender: { name: from.name, email: from.email },
      to: [{ email: to, ...(toName ? { name: toName } : {}) }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    });
  },
};

const resend = {
  async send({ to, subject, html, text, from, replyTo }) {
    const apiKey = need('MAIL_API_KEY');
    if (!from.email) throw new Error('MAIL_FROM_EMAIL is not set');
    await postJson('https://api.resend.com/emails', { Authorization: `Bearer ${apiKey}` }, {
      from: `${from.name} <${from.email}>`,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });
  },
};

const PROVIDERS = { log, brevo, resend };

export function getMailProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown MAIL_PROVIDER "${name}" (use log, brevo or resend)`);
  return provider;
}
