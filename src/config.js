// ⚠️ Firebase web app config'ini buraya yapıştır.
// Firebase Console → Project settings → "Your apps" → Web app → SDK setup.
// Bunlar gizli sırlar DEĞİL; güvenlik Firestore kurallarıyla sağlanır (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyDgDXgJfnflC9wesd19OhnjuTx5E8cnEqM",
  authDomain: "beemo-d96d8.firebaseapp.com",
  projectId: "beemo-d96d8",
  storageBucket: "beemo-d96d8.firebasestorage.app",
  messagingSenderId: "874064701796",
  appId: "1:874064701796:web:7b93c2f4518943f85c3271",
};

// manifest.json'daki oauth2.client_id ile AYNI olmalı.
export const OAUTH_CLIENT_ID = "874064701796-q6q15vv9cv2p6lobafr2105ga19iuf3h.apps.googleusercontent.com";

// ---- Billing (Lemon Squeezy) ----
// Lemon Squeezy'de bir abonelik ürünü + aylık varyant oluştur, "Share / Buy link"
// URL'ini buraya yapıştır (ör. https://STORE.lemonsqueezy.com/buy/UUID).
export const LEMONSQUEEZY_CHECKOUT_URL = "https://STORE.lemonsqueezy.com/buy/REPLACE_ME";
export const FREE_DAILY_SENDS = 5; // free planda günlük gönderim; alma her zaman sınırsız
