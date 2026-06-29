# Beemo billing setup (Stripe)

Beemo's paywall is **"receiving is free, sending is paid."** Free users get
`FREE_DAILY_SENDS` sends per day (set in `src/config.js`); beyond that they hit the
paywall. Pro = an active Stripe subscription (written by the Stripe extension with
the Admin SDK, so users can read but never forge it).

## 1) Firebase Blaze plan
Cloud Functions / the Stripe extension need the **Blaze** (pay-as-you-go) plan.
Firebase Console → upgrade to Blaze (set a budget alert).

## 2) Stripe account + product
1. Create a Stripe account (test mode is fine to start).
2. Stripe Dashboard → **Products** → add a product "Beemo Pro" with a **recurring
   monthly price** (e.g. $4.99/mo). Copy the **price ID** (`price_…`).

## 3) Install the Stripe extension
Firebase Console → **Extensions** → install **"Run Payments with Stripe"**
(`firestore-stripe-payments`). During setup:
- **Products/pricing collection**: `products`
- **Customers collection**: `customers`
- **Sync new users**: enable (creates a `customers/{uid}` on sign-up)
- Paste your **Stripe secret key** and set up the **webhook** (the extension shows
  the webhook URL → add it in Stripe → paste the signing secret back).

The extension will sync your product/price into `products/*` and write
subscriptions to `customers/{uid}/subscriptions/*`.

## 4) Wire the price ID
Put the price ID into `src/config.js`:
```js
export const STRIPE_PRICE_ID = "price_xxxxxxxxxxxx";
```
Then `npm run build` and reload the extension.

## 5) Test
- Use a Stripe **test card** `4242 4242 4242 4242`, any future expiry/CVC.
- Send until you hit the daily limit → the paywall appears → **Upgrade to Pro** →
  a Checkout tab opens → pay → the subscription syncs → sending is unlimited.

## Notes / hardening
- The daily-send gate is enforced **client-side** today. A determined user could
  bypass it by writing to Firestore directly. To make it airtight, move the send
  into a **Cloud Function** that checks the caller's plan + daily count server-side.
- To comp a user (free Pro), the simplest secure way is to give them a 100%-off
  Stripe coupon. (A `users/{uid}.plan = "pro"` field also flips Pro, but it's
  user-writable — only use it for local testing, not production.)
- Inbox docs carry `expireAt`; enable a Firestore **TTL policy** on the `inbox`
  collection group so storage stays bounded.
