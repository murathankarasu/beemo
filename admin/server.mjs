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
      const b = await db.collection("billing").doc(doc.id).get();
      if (b.exists) {
        const bd = b.data();
        sub = {
          active: !!bd.active,
          status: bd.status || null,
          source: bd.source || null,
          cancelAtPeriodEnd: !!bd.cancelAtPeriodEnd,
          currentPeriodEnd: secs(bd.cancelAtPeriodEnd ? bd.endsAt : bd.renewsAt),
        };
      }
    } catch {}
    out.push({
      uid: doc.id,
      displayName: u.displayName || "",
      email: u.email || "",
      photoURL: u.photoURL || "",
      plan: sub?.active ? "pro" : "free",
      usageSends: u.usageSends || 0,
      usageDate: u.usageDate || "",
      createdAt: secs(u.createdAt),
      sub,
      isPro: !!sub?.active,
    });
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

async function setPlan(uid, plan) {
  // Comp: write the admin-only billing doc. "pro" grants, anything else removes.
  await db
    .collection("billing")
    .doc(uid)
    .set(
      {
        active: plan === "pro",
        status: plan === "pro" ? "comp" : "comp_removed",
        source: "comp",
        cancelAtPeriodEnd: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
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
        return send(res, 200, { users: await listUsers(), stripe: false });
      }
      if (req.method === "POST" && url.pathname === "/api/plan") {
        const { uid, plan } = await readBody(req);
        if (!uid) return send(res, 400, { error: "uid required" });
        await setPlan(uid, plan);
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
  console.log(`    (Make/Remove Pro = comp via billing/{uid}; gerçek iptal Lemon Squeezy portalından)`);
  console.log("");
});
