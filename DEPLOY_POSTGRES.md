# Adding real, persistent data storage (Postgres)

The backend now stores everything in Postgres instead of a JSON file — this
was tested locally end-to-end (register → sync push → sync pull → restart
the server → data still there) before being written up here.

## 1. Create the database on Render

1. Render dashboard → **New +** → **PostgreSQL**.
2. Give it a name (e.g. `farmtrack-db`), pick the **Free** plan to start.
3. Click **Create Database**. Wait for it to go green/"Available".
4. Open it, find **Connections**, copy the **Internal Database URL** if your
   backend Web Service is in the same Render region (faster, free egress),
   or the **External Database URL** if you need to connect from outside
   Render (e.g. your own machine).

## 2. Connect the backend to it

1. Go to your backend **Web Service** in Render → **Environment**.
2. Add a variable: `DATABASE_URL` = the connection string you just copied.
3. Make sure `JWT_SECRET` is also set (see earlier setup) — it's unrelated
   to Postgres but easy to forget when you're already in this screen.
4. Save, then **Manual Deploy → Clear build cache & deploy**. The server
   creates its own tables automatically on first startup — no separate
   migration step to run.

## 3. Verify it worked

Check the Render logs for your backend service — you should see
`Orutumbo API listening on :4000` with no errors right after. Then sign up
for a new farm through your live site and confirm it works. If you want to
double-check the data is really there, Render's Postgres dashboard has a
**Shell** / query tool where you can run:

```sql
SELECT * FROM farms;
SELECT collection, id FROM records;
```

## Local development

1. Copy `backend/.env.example` to `backend/.env` (this file is gitignored —
   never commit real credentials).
2. Set `DATABASE_URL` to either:
   - the **External Database URL** from your Render Postgres (easiest —
     develop against the same real database), or
   - a Postgres running on your own machine, if you'd rather keep local
     dev data separate from anything real.
3. `npm run dev` as usual — the tables are created automatically the first
   time it connects.

## What changed under the hood

- `backend/db.js` — now a thin wrapper around `pg`, with `farms` and
  `users` as normal SQL tables, and one `records` table (columns:
  `collection`, `id`, `farm_id`, `data` as JSONB, `updated_at`, `deleted`)
  holding animals/inventory/ledger/tasks/farmers. JSONB was used instead of
  a fixed column per field because these records have gained new fields
  many times over this project (photos, vaccinations, stock brand...) —
  JSONB lets that keep happening without a schema migration each time.
- The offline-sync conflict resolution (last-write-wins on `updated_at`)
  now happens atomically inside a single SQL `INSERT ... ON CONFLICT`
  statement, rather than read-modify-write in the route code — safer
  under concurrent requests than the old file-based version.
- `backend/routes/*.js` — same endpoints, same request/response shapes;
  only the storage calls underneath changed. The frontend needed zero
  changes for this.
