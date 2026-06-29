// Google sign-in via chrome.identity → Firebase credential.
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase.js";
import { ensureUserProfile } from "./db.js";

// Set when the user explicitly signs out, so we DON'T silently sign them back in.
const SIGNED_OUT_FLAG = "beemo_explicit_signout";

function storageGet(key) {
  return new Promise((r) => chrome.storage.local.get(key, (o) => r(o[key])));
}
function storageSet(key, value) {
  return new Promise((r) => chrome.storage.local.set({ [key]: value }, r));
}

function getGoogleToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "No token"));
      } else {
        resolve(token);
      }
    });
  });
}
function removeCachedToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}
function clearAllCachedTokens() {
  return new Promise((resolve) => chrome.identity.clearAllCachedAuthTokens(resolve));
}

export async function signIn() {
  await storageSet(SIGNED_OUT_FLAG, false);
  const token = await getGoogleToken(true);
  const credential = GoogleAuthProvider.credential(null, token);
  const { user } = await signInWithCredential(auth, credential);
  await ensureUserProfile(user);
  return user;
}

export async function signOut() {
  // Remember the choice + drop every cached Google token so the next sign-in
  // shows the account picker instead of silently reusing the last account.
  await storageSet(SIGNED_OUT_FLAG, true);
  try {
    const token = await getGoogleToken(false).catch(() => null);
    await removeCachedToken(token);
    await clearAllCachedTokens();
  } catch {}
  await fbSignOut(auth);
}

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// Keep the session alive across panel re-opens — but never auto-login after an
// explicit sign-out.
export async function trySilentSignIn() {
  if (await storageGet(SIGNED_OUT_FLAG)) return null;
  try {
    const token = await getGoogleToken(false);
    const credential = GoogleAuthProvider.credential(null, token);
    const { user } = await signInWithCredential(auth, credential);
    await ensureUserProfile(user);
    return user;
  } catch {
    return null;
  }
}
