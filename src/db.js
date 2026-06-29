// Firestore veri katmanı.
//
// Model:
//   users/{uid}                          profil + publicKey
//   users/{uid}/requests/{fromUid}       gelen arkadaşlık istekleri
//   users/{uid}/friends/{friendUid}      kabul edilmiş arkadaşlar (publicKey kopyası ile)
//   users/{uid}/inbox/{msgId}            gelen gönderiler (sekme/text/parola)
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  orderBy,
  Timestamp,
} from "firebase/firestore";

// Inbox items auto-expire so storage stays cheap (enable a Firestore TTL policy
// on the `expireAt` field of the inbox collection group).
const INBOX_TTL_DAYS = 30;
import { db } from "./firebase.js";

function handleFromEmail(email) {
  const base = (email || "user").split("@")[0].replace(/[^a-z0-9._-]/gi, "").toLowerCase();
  return base.slice(0, 20);
}

// Giriş sonrası profili yaz/güncelle.
export async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const data = {
    uid: user.uid,
    displayName: user.displayName || "İsimsiz",
    email: (user.email || "").toLowerCase(),
    photoURL: user.photoURL || "",
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) {
    data.handle = handleFromEmail(user.email);
    data.createdAt = serverTimestamp();
  }
  await setDoc(ref, data, { merge: true });
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// E-posta ile kullanıcı bul (arkadaş eklemek için).
export async function findUserByEmail(email) {
  const q = query(
    collection(db, "users"),
    where("email", "==", email.trim().toLowerCase()),
    limit(1)
  );
  const res = await getDocs(q);
  return res.empty ? null : res.docs[0].data();
}

// İstek gönder: hedefin requests koleksiyonuna kendi bilgini yaz.
export async function sendFriendRequest(me, targetUid) {
  if (targetUid === me.uid) throw new Error("Kendine istek gönderemezsin");
  const ref = doc(db, "users", targetUid, "requests", me.uid);
  await setDoc(ref, {
    fromUid: me.uid,
    fromName: me.displayName || "İsimsiz",
    fromPhoto: me.photoURL || "",
    fromEmail: (me.email || "").toLowerCase(),
    createdAt: serverTimestamp(),
  });
}

export function watchRequests(uid, cb) {
  const q = query(collection(db, "users", uid, "requests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

// ---- Invites (viral loop): invite a friend who isn't on Beemo yet ----
function makeInviteCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 7; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export async function createInvite(me, targetEmail) {
  const code = makeInviteCode();
  await setDoc(doc(db, "invites", code), {
    code,
    from: me.uid,
    fromName: me.displayName || "İsimsiz",
    fromPhoto: me.photoURL || "",
    fromEmail: (me.email || "").toLowerCase(),
    targetEmail: (targetEmail || "").toLowerCase(),
    redeemedBy: null,
    createdAt: serverTimestamp(),
  });
  return code;
}

// Redeem an invite code → become mutual friends with the inviter.
export async function redeemInvite(me, rawCode) {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) throw new Error("Empty code");
  const ref = doc(db, "invites", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Invite not found");
  const inv = snap.data();
  if (inv.from === me.uid) throw new Error("That's your own invite");
  const inviter = await getProfile(inv.from);
  if (!inviter) throw new Error("Inviter not found");

  await setDoc(doc(db, "users", me.uid, "friends", inviter.uid), {
    uid: inviter.uid,
    displayName: inviter.displayName,
    photoURL: inviter.photoURL || "",
    handle: inviter.handle || "",
    addedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "users", inviter.uid, "friends", me.uid), {
    uid: me.uid,
    displayName: me.displayName || "İsimsiz",
    photoURL: me.photoURL || "",
    addedAt: serverTimestamp(),
  });
  await setDoc(ref, { redeemedBy: me.uid, redeemedAt: serverTimestamp() }, { merge: true });
  return inviter;
}

// İsteği kabul et: her iki tarafı da birbirinin friends listesine ekle.
export async function acceptRequest(me, fromUid) {
  const theirProfile = await getProfile(fromUid);
  if (!theirProfile) throw new Error("Kullanıcı bulunamadı");

  // Onları benim listeme ekle
  await setDoc(doc(db, "users", me.uid, "friends", fromUid), {
    uid: theirProfile.uid,
    displayName: theirProfile.displayName,
    photoURL: theirProfile.photoURL || "",
    handle: theirProfile.handle || "",
    addedAt: serverTimestamp(),
  });
  // Beni onların listesine ekle (kurallar: friendId == auth.uid ise izinli)
  await setDoc(doc(db, "users", fromUid, "friends", me.uid), {
    uid: me.uid,
    displayName: me.displayName || "İsimsiz",
    photoURL: me.photoURL || "",
    addedAt: serverTimestamp(),
  });
  // İsteği sil
  await deleteDoc(doc(db, "users", me.uid, "requests", fromUid));
}

export async function declineRequest(uid, fromUid) {
  await deleteDoc(doc(db, "users", uid, "requests", fromUid));
}

export function watchFriends(uid, cb) {
  const q = query(collection(db, "users", uid, "friends"), orderBy("addedAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

// Arkadaşa bir öğe yolla — onun inbox'una yaz.
//   type: "tab" | "tabgroup" | "text" | "password"
//   payload: tab/text/tabgroup için düz nesne; password için encryptFor() paketi
export async function sendItem(me, friendUid, { type, payload, encrypted }) {
  const id = crypto.randomUUID();
  await setDoc(doc(db, "users", friendUid, "inbox", id), {
    id,
    from: me.uid,
    fromName: me.displayName || "İsimsiz",
    fromPhoto: me.photoURL || "",
    type,
    payload,
    encrypted: !!encrypted,
    read: false,
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + INBOX_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
}

export function watchInbox(uid, cb) {
  const q = query(collection(db, "users", uid, "inbox"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

export async function markRead(uid, msgId) {
  await setDoc(doc(db, "users", uid, "inbox", msgId), { read: true }, { merge: true });
}

export async function deleteInboxItem(uid, msgId) {
  await deleteDoc(doc(db, "users", uid, "inbox", msgId));
}
