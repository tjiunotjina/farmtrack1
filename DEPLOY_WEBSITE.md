# Orutumbo website (marketing + sign-up)

`website/` is a plain static site: HTML, CSS and a little JavaScript. There is
no build step and nothing to install. It explains the product, shows pricing
(pulled live from your API, with built-in prices as a fallback) and has a
sign-up form that creates a farm account through your existing backend.

## 1. Edit `website/config.js`

- `API_URL`: your backend (the Render Web Service). No trailing slash.
- `APP_URL`: your app (the Render Static Site). The "Open Orutumbo" button
  after sign-up goes here.
- `CONTACT_EMAIL`: shown in the footer and on the Enterprise plan. Leave it
  empty and both are hidden. Set it before you launch, or Enterprise buyers
  have no way to reach you.

## 2. Try it on your machine

```bash
cd website
python3 -m http.server 8080
```

Open http://localhost:8080. It talks to whatever `API_URL` points at. To
test against your local backend, set `API_URL` to `http://localhost:4000`.

## 3. Put it online (free)

**Render:** New + > Static Site > pick this repo. Root Directory `website`,
leave Build Command empty, Publish Directory `.`. This is a third service,
separate from your backend and your app.

**Netlify:** drag the `website` folder onto https://app.netlify.com/drop.

## 4. How sign-up works

The form sends the same request the app's own sign-up screen sends
(`POST /api/auth/register`). That creates the farm and starts the 30-day
Standard trial. The site then tells the person to open the app and log in
with the email and password they just chose. The site does not log them in
itself, because the app keeps its login on its own address.

The Render free backend sleeps when idle, so the first sign-up can take up
to a minute. The form tells people this while they wait.

## Before you announce it publicly

- **Rate limiting.** The sign-up form is public, so anyone can create
  accounts in bulk. Add rate limiting to `/api/auth/register` (for example
  `express-rate-limit`). The form has a basic hidden-field trap for simple
  bots, which does not stop a determined one.
- **Terms and Privacy.** You store farmers' names, emails and phone numbers.
  Add a short privacy policy and terms page and link them from the footer.
- **Changing prices.** The site reads live prices and animal limits from
  `/api/billing/plans`. The `PLANS` list at the top of the pricing section
  in `website/app.js` is only the fallback shown while the API wakes up or
  if it is unreachable; update it too if you change prices.
- **What it advertises.** The site only mentions things the app does today.
  The plans also list reports, crop management and data export, which are
  not built yet, so they are left off. Add them to the site when they exist.
