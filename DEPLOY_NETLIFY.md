# Deploying Orutumbo to Netlify

This deploys as **one Netlify site**: the frontend as static files, and the
whole backend API as a single serverless function, using Netlify's own
persistent storage (Netlify Blobs) instead of a file on disk — which is why
this is a different backend from the `backend/` folder used for local dev.
No separate server to host, no database to set up.

## Deploy

**Option A — drag and drop (fastest, no git needed)**
1. Run `npm install` in the repo root, then in `frontend/` (see below) so
   everything builds locally, or just let Netlify do it (Option B is easier
   for that). If you want to test the drag-and-drop route: build locally
   first (`cd frontend && npm install && npm run build`), then drag the
   whole `farmtrack` folder (not just `dist`) onto https://app.netlify.com/drop.
   Netlify reads `netlify.toml` and knows what to do with it.

**Option B — connect your git repo (recommended, gets auto-deploys on push)**
1. Push this project to GitHub/GitLab/Bitbucket.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Netlify auto-detects `netlify.toml` — build command, publish directory,
   and the functions directory are already configured. Just click **Deploy**.

## One required setting: JWT_SECRET

Before (or right after) your first deploy, set an environment variable so
login tokens are signed with something other than the built-in placeholder:

**Site settings → Environment variables → Add a variable**
- Key: `JWT_SECRET`
- Value: any long random string (e.g. generate one with `openssl rand -hex 32`)

Redeploy after adding it (Netlify → Deploys → Trigger deploy) if you set it
after the first deploy.

## Netlify Blobs — no setup needed

Netlify Blobs is automatically available to any function running on a
Netlify site — no signup, no connection string, no extra service. That's
what makes this a single-host deploy. Data lives in:
- `users/{email}` — one entry per account, for login lookup
- `farms/{farmId}` — farm profile (name, village, owner, stock brand)
- `data/{farmId}` — that farm's animals, inventory, ledger, and tasks

You can inspect stored blobs from **Site → Blobs** in the Netlify dashboard
if you ever need to debug what's actually saved.

## After deploying: smoke-test it

1. Open your new `*.netlify.app` URL — you should land on the sign-up screen.
2. Sign up with a test farm. If this fails, check **Functions** in the
   Netlify dashboard for a log — the most likely culprit is `JWT_SECRET`
   not being set yet, or the build not picking up the root `package.json`
   dependencies (check the deploy log's build output).
3. Add an animal, go offline (DevTools → Network → Offline), add another,
   go back online, confirm the sync status pill clears its "queued" count.
4. Open the same URL on your phone and log in with the same account —
   your data should already be there, proving the cross-device sync works
   end-to-end through the deployed function.

## Local dev is unaffected

`backend/` (the standalone Express + local-file server) is still there and
still what `frontend`'s `npm run dev` talks to by default — nothing about
local development changed. The `netlify/functions/` version is only used
once deployed to Netlify (or if you run `netlify dev` locally with the
Netlify CLI, which can emulate Blobs locally too, if you'd rather test that
path before deploying).

## Custom domain / going further

Once deployed, **Site settings → Domain management** covers custom domains
and HTTPS (Netlify provisions this automatically). Nothing else in this
project needs to change for that.
