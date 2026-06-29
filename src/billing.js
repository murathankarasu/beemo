// Billing via the official "Run Payments with Stripe" Firebase extension
// (firestore-stripe-payments). The extension writes subscription state with the
// Admin SDK, so users can READ but never forge their Pro status.
//
// Data model the extension uses:
//   customers/{uid}/checkout_sessions/{id}  ← we create; extension fills `url`
//   customers/{uid}/subscriptions/{id}      ← extension writes; status === active
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase.js";

// Open the Stripe customer portal (manage / cancel subscription, update card).
export async function openCustomerPortal(returnUrl) {
  const fn = httpsCallable(functions, "ext-firestore-stripe-payments-createPortalLink");
  const { data } = await fn({ returnUrl });
  return data.url;
}

// Pro = has an active (or trialing) subscription.
export function watchPro(uid, cb) {
  const q = query(
    collection(db, "customers", uid, "subscriptions"),
    where("status", "in", ["trialing", "active"])
  );
  return onSnapshot(
    q,
    (snap) => cb(!snap.empty),
    () => cb(false)
  );
}

// Create a Stripe Checkout session and return its URL (open it in a new tab).
export async function startCheckout(uid, priceId, successUrl, cancelUrl) {
  const ref = await addDoc(collection(db, "customers", uid, "checkout_sessions"), {
    price: priceId,
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });
  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      if (data.error) {
        unsub();
        reject(new Error(data.error.message || "Checkout failed"));
      }
      if (data.url) {
        unsub();
        resolve(data.url);
      }
    });
  });
}
