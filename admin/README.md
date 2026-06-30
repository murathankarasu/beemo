# Beemo Admin (local)

A tiny localhost dashboard to view users and manage Pro / subscriptions. It uses
the **Firebase Admin service account**, so it runs only on `127.0.0.1` and must
never be deployed publicly without real authentication.

## Setup
1. Put a Firebase **service account key** in the repo root (it's gitignored), or
   point to it with `SA_PATH`. Get one from:
   Firebase Console → Project settings → **Service accounts → Generate new private key**.
2. Install + run:
   ```bash
   cd admin
   npm install
   npm start
   ```
3. The terminal prints an **Admin token** and the URL `http://127.0.0.1:8787`.
   Open it, paste the token when asked.

## What you can do
- See every user: name, email, plan, subscription status + renewal/cancel date, daily usage.
- **Make Pro / Remove Pro** — sets a `plan` comp field (instant, no Stripe needed).
- **Cancel / Resume** a Stripe subscription — only enabled if you start with a key:
  ```bash
  STRIPE_SECRET_KEY=sk_test_xxx npm start
  ```
  (Cancel = at period end; Resume = undo.)

## Options (env)
- `SA_PATH` — path to the service account JSON (default: auto-detect in repo root)
- `ADMIN_TOKEN` — fixed token instead of a random one each start
- `STRIPE_SECRET_KEY` — enables subscription cancel/resume
- `PORT` — default 8787

## Security
- Never expose this publicly as-is — the service account can read/write everything.
- For a hosted (Vercel) version you'd need: secrets as env vars + a real login in
  front of every `/api/*` route.
