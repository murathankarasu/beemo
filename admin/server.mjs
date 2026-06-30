// Beemo local admin dashboard.
// Runs ONLY on 127.0.0.1 and uses the Firebase Admin service account, so it must
// never be exposed publicly without real auth. View users, grant/revoke Pro (a
// `plan` field comp), and cancel/resume Stripe subscriptions.
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// ---- Locate the service account key ----
let saPath = process.env.SA_PATH;
if (!saPath) {
  const f = readdirSync(repoRoot).find((x) => /firebase-adminsdk.*\.json$/.test(x));
  if (f) saPath = path.join(repoRoot, f);
}
if (!saPath || !existsSync(saPath)) {
  console.error(
    "\n❌ Service account JSON bulunamadı.\n" +
      "   Firebase Console → Project settings → Service accounts → Generate new private key\n" +
      "   indirip repo köküne koy (gitignore'da) ya da SA_PATH=/yol/key.json ver.\n"
  );
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ||
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const PORT = Number(process.env.PORT || 8787);

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch {
        resolve({});
      }
    });
  });
const authed = (req) => req.headers["x-admin-token"] === ADMIN_TOKEN;
const secs = (ts) => ts?._seconds ?? ts?.seconds ?? null;

async function listUsers() {
  const snap = await db.collection("users").get();
  const out = [];
  for (const doc of snap.docs) {
    const u = doc.data();
    let sub = null;
    try {
      const s = await db
        .collection("customers")
        .doc(doc.id)
        .collection("subscriptions")
        .where("status", "in", ["active", "trialing"])
        .limit(1)
        .get();
      if (!s.empty) {
        const sd = s.docs[0].data();
        sub = {
          id: s.docs[0].id,
          status: sd.status,
          cancelAtPeriodEnd: !!sd.cancel_at_period_end,
          currentPeriodEnd: secs(sd.current_period_end),
        };
      }
    } catch {}
    out.push({
      uid: doc.id,
      displayName: u.displayName || "",
      email: u.email || "",
      photoURL: u.photoURL || "",
      plan: u.plan || "free",
      usageSends: u.usageSends || 0,
      usageDate: u.usageDate || "",
      createdAt: secs(u.createdAt),
      sub,
      isPro: u.plan === "pro" || !!sub,
    });
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

async function setPlan(uid, plan) {
  // "pro" = comp (grant), anything else removes the comp field.
  await db
    .collection("users")
    .doc(uid)
    .set(
      { plan: plan === "pro" ? "pro" : admin.firestore.FieldValue.delete() },
      { merge: true }
    );
}

async function setCancel(subId, cancel) {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY env verilmedi (abonelik iptali kapalı)");
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: `cancel_at_period_end=${cancel ? "true" : "false"}`,
  });
  if (!res.ok) throw new Error("Stripe: " + (await res.text()));
  return res.json();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/") {
    return send(res, 200, readFileSync(path.join(__dirname, "index.html"), "utf8"), "text/html; charset=utf-8");
  }
  if (url.pathname.startsWith("/api/")) {
    if (!authed(req)) return send(res, 401, { error: "unauthorized" });
    try {
      if (req.method === "GET" && url.pathname === "/api/users") {
        return send(res, 200, { users: await listUsers(), stripe: !!STRIPE_SECRET_KEY });
      }
      if (req.method === "POST" && url.pathname === "/api/plan") {
        const { uid, plan } = await readBody(req);
        if (!uid) return send(res, 400, { error: "uid required" });
        await setPlan(uid, plan);
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/cancel") {
        const { subId, cancel } = await readBody(req);
        if (!subId) return send(res, 400, { error: "subId required" });
        await setCancel(subId, cancel !== false);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "not found" });
    } catch (e) {
      return send(res, 500, { error: String(e?.message || e) });
    }
  }
  send(res, 404, "not found", "text/plain");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n🐝  Beemo admin → http://127.0.0.1:${PORT}`);
  console.log(`    Admin token: ${ADMIN_TOKEN}`);
  if (!STRIPE_SECRET_KEY) console.log(`    (STRIPE_SECRET_KEY env verirsen abonelik iptal/resume da açılır)`);
  console.log("");
});
