# Publishing Beemo to the Chrome Web Store

Build the upload package any time with:
```bash
npm run build
cd dist && zip -rq ../beemo-0.1.0.zip . && cd ..
```
Upload `beemo-0.1.0.zip` (manifest.json is at its root — required).

## ⚠️ Two critical gotchas (do these or sign-in breaks in production)

### 1) Keep the extension ID stable (OAuth depends on it)
`chrome.identity.getAuthToken` is tied to a specific extension ID, and the Web
Store assigns a NEW id on publish — which would break Google sign-in.
Fix after your first upload:
1. In the Web Store dashboard → your item → **Package** → copy the **public key**.
2. Add it to `src/manifest.json` as a top-level `"key": "<public key>"`, rebuild.
   Now the dev (unpacked) id and the published id are the same.
3. In Google Cloud → **Credentials** → your OAuth client (type Chrome Extension),
   make sure its **Item ID** matches that id. (It already uses the current dev id
   `jpampllhblhgjgkikdkjnodiboggdjnl`; if you add the matching `key`, you're set.)

### 2) Publish the OAuth consent screen
Google Cloud → **APIs & Services → OAuth consent screen** → **Publish app**
(move from "Testing" to "In production"). Scopes are only `openid email profile`
(non-sensitive), so **no Google verification is required** and users won't see a
warning. If you leave it in Testing, only your added test users can sign in.

## Store submission checklist
- [ ] Pay the **one-time $5** developer registration fee (first time only).
- [ ] Create item → upload `beemo-0.1.0.zip`.
- [ ] **Privacy policy URL**: `https://beemo-ten.vercel.app/privacy.html`
      (update the contact email in `docs/privacy.html` to one you actually read).
- [ ] **Single purpose**: "Send tabs, tab groups, and text to friends, Chrome to Chrome."
- [ ] **Permission justifications** (paste in the dashboard):
  - `identity` — Google sign-in to identify you to friends.
  - `tabs` / `tabGroups` — read the current tab/group you choose to send.
  - `storage` — store your device key/keypair and pending state.
  - `sidePanel` — the app UI lives in the side panel.
  - `contextMenus` — right-click "send to a friend".
  - `scripting` + optional host — only to read non-password form fields when you
    explicitly tick "include what I typed", and to refill them on the receiver side.
  - `notifications` — notify you when a friend sends something.
- [ ] **Category**: Social & Communication (or Productivity).
- [ ] **Screenshots**: at least one 1280×800 (or 640×400). Capture the Send + Inbox screens.
- [ ] Submit for review.

## After it's published
- [ ] Update the landing "Add Beemo to Chrome" button (`docs/index.html`) to the
      Web Store URL.
- [ ] For **real payments**, take Lemon Squeezy out of **Test mode**: use the live
      store/buy link in `src/config.js` and the live webhook (see BILLING.md). Until
      then billing runs in test mode — no real charges.

## Recommended before charging real money
- [ ] Move the daily-send quota check into a Cloud Function (server-enforced) so it
      can't be bypassed client-side. See note in BILLING.md.
