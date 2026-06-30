# Beemo billing setup (Lemon Squeezy)

Beemo's paywall is **"receiving is free, sending is paid."** Free users get
`FREE_DAILY_SENDS` sends/day (`src/config.js`); beyond that they hit the paywall.

We use **Lemon Squeezy** (Merchant of Record): it pays out to Turkey, handles
global VAT/tax, and runs the checkout + customer portal. A Firebase **Cloud
Function** receives its webhooks and writes entitlement to `billing/{uid}`
(admin-only → users can read but never forge Pro).

## 1) Lemon Squeezy product
1. Create a Lemon Squeezy account → set up your **Store** (payout via Wise works for Turkey).
2. **Products → New Product** → type **Subscription**, add a **monthly** variant (e.g. $4.99).
3. Open the variant → **Share** → copy the **buy link**
   (`https://YOURSTORE.lemonsqueezy.com/buy/UUID`).
4. Paste it into `src/config.js` → `LEMONSQUEEZY_CHECKOUT_URL`, then `npm run build`.

## 2) Deploy the webhook (Cloud Function)
```bash
npm i -g firebase-tools
firebase login
cd functions && npm install && cd ..

# pick any random string as the signing secret; you'll paste the SAME one in LS
firebase functions:secrets:set LEMON_SIGNING_SECRET

firebase deploy --only functions
```
Deploy prints the URL:
`https://us-central1-beemo-d96d8.cloudfunctions.net/lemonWebhook`

## 3) Connect the webhook in Lemon Squeezy
Lemon Squeezy → **Settings → Webhooks → +**:
- **Callback URL**: the `lemonWebhook` URL above
- **Signing secret**: the same string you set in step 2
- **Events**: `subscription_created`, `subscription_updated`, `subscription_cancelled`,
  `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`

## 4) Publish Firestore rules
The `billing/{uid}` rule was added. Either paste `firestore.rules` in the console
and Publish, or:
```bash
firebase deploy --only firestore:rules
```

## 5) Test
- Turn on **Test mode** in Lemon Squeezy, use its test card.
- In Beemo: hit the daily limit → paywall → **Upgrade** → LS checkout opens with your
  uid attached → pay → the webhook writes `billing/{uid}` → Beemo flips to **PRO**.
- **Manage subscription** (Settings) opens the LS customer portal to cancel/update.

## Admin & comps
- `admin/` dashboard "Make Pro / Remove Pro" writes `billing/{uid}` as a comp —
  no Lemon Squeezy needed, instant.
- Real cancellations happen in the LS customer portal (or LS dashboard); the webhook
  syncs the change back to `billing/{uid}`.

## Notes
- You can uninstall the old "Run Payments with Stripe" extension — it's unused now.
- The daily-send quota is still enforced client-side; move it into a Cloud Function
  before relying on it to gate real revenue.
