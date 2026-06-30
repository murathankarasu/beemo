// Beemo billing webhook for Lemon Squeezy.
// Lemon Squeezy posts subscription events here; we verify the signature and write
// the user's entitlement to billing/{uid} (admin-only, so it can't be forged).
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const LEMON_SIGNING_SECRET = defineSecret("LEMON_SIGNING_SECRET");

// Statuses that should unlock Pro (past_due keeps access during the grace period).
const ACTIVE = new Set(["active", "on_trial", "past_due"]);

exports.lemonWebhook = onRequest(
  { secrets: [LEMON_SIGNING_SECRET], region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("method not allowed");

      // Verify HMAC signature over the raw body.
      const secret = LEMON_SIGNING_SECRET.value();
      const signature = req.get("X-Signature") || "";
      const digest = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
      if (
        signature.length !== digest.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
      ) {
        return res.status(401).send("invalid signature");
      }

      const body = req.body || {};
      const uid = body?.meta?.custom_data?.uid;
      const attr = body?.data?.attributes || {};
      if (!uid) return res.status(200).send("ignored (no uid)");

      const status = attr.status; // active | on_trial | paused | past_due | unpaid | cancelled | expired
      const toTs = (s) => (s ? admin.firestore.Timestamp.fromDate(new Date(s)) : null);

      // A cancelled subscription keeps Pro until the paid period ends; only once
      // it actually expires (or is paused/unpaid) does access drop.
      const endsMs = attr.ends_at ? new Date(attr.ends_at).getTime() : null;
      const active =
        status === "cancelled" ? (endsMs ? endsMs > Date.now() : false) : ACTIVE.has(status);

      await admin
        .firestore()
        .doc(`billing/${uid}`)
        .set(
          {
            active,
            status: status || null,
            cancelAtPeriodEnd: !!attr.cancelled,
            renewsAt: toTs(attr.renews_at),
            endsAt: toTs(attr.ends_at),
            portalUrl: attr.urls?.customer_portal || attr.urls?.update_payment_method || null,
            source: "lemonsqueezy",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return res.status(200).send("ok");
    } catch (e) {
      console.error("lemonWebhook error", e);
      return res.status(500).send("error");
    }
  }
);
