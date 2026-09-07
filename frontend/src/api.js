// Local dev (`npm run dev`) talks to the standalone backend/server.js on
// :4000 by default. A production build (what `netlify build` runs) defaults
// to '' — a relative path — so /api/* hits the same Netlify site's own
// function via the redirect in netlify.toml, no separate host needed.
// VITE_API_URL always overrides both, if you want to point at something else.
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  syncPush: (token, collection, records) =>
    request('/api/sync/push', { method: 'POST', body: { collection, records }, token }),
  syncPull: (token, since) =>
    request(`/api/sync/pull?since=${encodeURIComponent(since || '')}`, { token }),
};
