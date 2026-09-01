# Testing the PWA build

This `dist/` folder is the production PWA build — the same thing a real deploy
would serve. Testing against this (rather than `npm run dev`) is the most
accurate way to check installability and offline behavior, because the
service worker only fully activates on a built, served app.

## Serve it

From this `frontend` folder:

```bash
npx serve -s dist -l 5173
```

(or `python3 -m http.server 5173 --directory dist`, or any static file server)

Then open **http://localhost:5173**.

## What to test

1. **Install prompt** — on Chrome/Edge desktop, look for an install icon in
   the address bar. On Android Chrome, look for "Add to Home screen" in the
   menu. On iPhone Safari, use the Share button → "Add to Home Screen."
2. **Offline** — open DevTools → Network tab → set to "Offline," reload the
   page. It should still load and work (app shell is cached by the service
   worker).
3. **Backend still needed for sync** — the app itself works fully offline,
   but signing up and syncing data to the server needs the backend running
   too (`cd ../backend && npm install && npm run dev`, port 4000). If you
   only want to test the offline app-shell behavior, you can skip the
   backend — you just won't be able to sign up until it's running once.
