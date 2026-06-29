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

// ---- Billing (Stripe) ----
// Stripe'ta bir ürün + aylık fiyat oluştur; firestore-stripe-payments eklentisi
// fiyatı Firestore'a senkronlar. O fiyatın price_id'sini buraya yapıştır.
export const STRIPE_PRICE_ID = "price_1TnmjOFsN5ZpT0lT6sffuPS7";
export const FREE_DAILY_SENDS = 5; // free planda günlük gönderim; alma her zaman sınırsız
export const CHECKOUT_SUCCESS_URL = "https://murathankarasu.github.io/Beemo/?checkout=success";
export const CHECKOUT_CANCEL_URL = "https://murathankarasu.github.io/Beemo/?checkout=cancel";
