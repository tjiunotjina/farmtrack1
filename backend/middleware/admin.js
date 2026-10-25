import crypto from 'crypto';

// Admin access is one shared secret (ADMIN_SECRET), sent in the
// x-admin-secret header. Good enough while you are the only operator; move to
// real admin accounts before anyone else needs access. Failed attempts are
// counted per IP so the secret cannot be guessed by brute force.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // ip -> { count, resetAt }

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'Admin access is not configured on this server' });

  const now = Date.now();
  const ip = req.ip || 'unknown';
  let entry = failures.get(ip);
  if (entry && entry.resetAt <= now) { failures.delete(ip); entry = undefined; }
  if (entry && entry.count >= MAX_FAILURES) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }

  // Hashing first makes the comparison constant-time regardless of length.
  if (!crypto.timingSafeEqual(digest(req.headers['x-admin-secret'] || ''), digest(secret))) {
    failures.set(ip, { count: (entry?.count || 0) + 1, resetAt: entry?.resetAt || now + WINDOW_MS });
    return res.status(401).json({ error: 'Invalid admin secret' });
  }
  failures.delete(ip);
  next();
}
