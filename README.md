# FarmTrack

An offline-first livestock and farm management app, built to be sold to multiple farmers as a product (multi-tenant: every farm's data is isolated).

## What's here

```
farmtrack/
  backend/     Express API — auth, multi-tenant data, offline sync endpoints
  frontend/    React + Vite PWA — works fully offline, installable to a phone's home screen
```

## How offline-first works

- The frontend never talks to the network directly for reads/writes. Every screen reads and writes to an on-device database (IndexedDB, via Dexie) — see `frontend/src/db.js`.
- Every write is stamped `dirty: 1` and timestamped.
- A sync engine (`frontend/src/sync.js`) runs on launch, when the device comes back online, and every 60s in the background: it pushes anything dirty to the server, then pulls anything the server has that's newer than the last sync.
- Conflicts are resolved last-write-wins on `updated_at` — simple and predictable, good enough for a single farm's small team.
- The app is a PWA (`vite-plugin-pwa`), so it's installable on a phone and the app shell itself is cached — it opens with zero connectivity, not just "works after first load."

## Multi-tenancy (selling to many farmers)

Every record carries a `farm_id`. Signup creates a `farm` (name, village, owner) plus an `owner` user scoped to it. All API routes require a JWT and filter every query by the farm ID inside that token — one farmer can never read or write another farmer's data.

## Running it locally

**Backend:**
```bash
cd backend
npm install
npm run dev        # http://localhost:4000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open the frontend, create a farm account (farm name, village, owner name, email, password), and you're in. Try switching your device to airplane mode — the app keeps working, and syncs the moment you're back online.

## What's intentionally simple (and the real next steps)

This is an MVP-quality build meant to prove the architecture end-to-end, not a production deployment:

- **Database:** the backend currently uses a JSON file (`lowdb`) so it runs anywhere with zero setup. Swap `backend/db.js` for Postgres (or similar) before real users touch it — the route files don't need to change, only that file.
- **Auth:** JWT + bcrypt is solid, but there's no password reset, email verification, or multi-user-per-farm roles yet (e.g. owner + workers with different permissions).
- **Hosting:** needs a real host for the backend (Render, Railway, Fly.io, etc.) and a build/deploy for the frontend (Vercel, Netlify, or bundled into a Capacitor app for app-store distribution).
- **Photos:** animal photos aren't wired up yet — worth adding since farmers often want a visual record.
