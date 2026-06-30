// Billing via Lemon Squeezy (Merchant of Record — pays out to Turkey, handles tax).
//
// Entitlement lives in billing/{uid}, written ONLY by our Cloud Function webhook
// (or the admin tool), so users can read but never forge their Pro status.
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { LEMONSQUEEZY_CHECKOUT_URL } from "./config.js";

// Watch the user's entitlement doc. cb receives { active, status, renewsAt,
// endsAt, cancelAtPeriodEnd, portalUrl } or null.
export function watchBilling(uid, cb) {
  return onSnapshot(
    doc(db, "billing", uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null)
  );
}

// Hosted Lemon Squeezy checkout, with the Firebase uid passed as custom data so
// the webhook can map the subscription back to this user.
export function checkoutUrl(uid, email) {
  // Build the query manually to keep the literal checkout[...] brackets.
  const parts = [`checkout[custom][uid]=${encodeURIComponent(uid)}`];
  if (email) parts.push(`checkout[email]=${encodeURIComponent(email)}`);
  const sep = LEMONSQUEEZY_CHECKOUT_URL.includes("?") ? "&" : "?";
  return LEMONSQUEEZY_CHECKOUT_URL + sep + parts.join("&");
}
