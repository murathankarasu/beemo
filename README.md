# Beemo — Send tabs, tab groups & text to a friend

Send the tab you're on, a tab group, or a note straight to a friend's Chrome — in **one shortcut**.
No more copy → open WhatsApp/Discord → paste. Like DMs, but for your browser.

## Features
- 🔗 Send the current tab or any link
- 🗂️ Send a tab group (or every tab in the window) — and **remove tabs you don't want** before sending
- 📝 Send text, notes, and snippets (also from the right-click menu)
- 📋 Optionally carry a page's **form values** with a shared tab so they're pre-filled on open (passwords never included)
- 👥 Add friends by email, accept/decline requests
- ⌨️ Shortcut: `Cmd/Ctrl+Shift+S` opens the panel ready to send the current tab
- 🔔 Real-time inbox with a browser notification when something arrives (while the panel is open)

## Architecture
- **Extension**: Manifest V3 with `chrome.sidePanel`, `chrome.commands`, `chrome.contextMenus`, `chrome.scripting`
- **Backend**: Firebase (Google Auth + Firestore real-time). No server code.
- **Build**: esbuild bundles Firebase locally (MV3 forbids remote code). The logo is rasterized from `src/logo.svg`.
- **Permissions**: form-fill uses `optional_host_permissions`, requested per-site at runtime — not a blanket "read all sites" grant.

```
src/              source
build.mjs         esbuild + icon rasterization
dist/             build output ← load this in Chrome
firestore.rules   security rules
```

## Setup

### 1) Install & build
```bash
npm install
npm run build      # produces dist/
```

### 2) Firebase
1. Create a project at https://console.firebase.google.com
2. **Authentication → Sign-in method → Google** → enable
3. **Firestore Database** → create (production mode)
4. **Rules** → paste `firestore.rules` → Publish
5. Project settings → **Your apps → Web app** → copy the config into `src/config.js`

### 3) Google OAuth (for chrome.identity)
1. Load the extension (step 4) and copy its **Extension ID**
2. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID**
3. Type **Chrome Extension** → paste the Extension ID
4. Put the client ID into `src/manifest.json` (`oauth2.client_id`) → `npm run build`

### 4) Load in Chrome
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `dist/`

## Development
```bash
npm run watch   # rebuilds dist/ on change; reload from chrome://extensions
```

## Testing (two accounts)
Use two Chrome profiles / Google accounts:
1. Install + sign in on both
2. Add each other by email and accept the request
3. Send a tab / tab group / text — it appears in the other's Inbox instantly

## Privacy & data
- **Sign-in**: Google account (name, email, photo) is stored in Firestore only to identify you to friends.
- **What's stored**: your profile, your friends list, and items in each user's inbox until deleted.
- **Form-fill** values travel with a shared tab only when you opt in, per-site, and **never include password or hidden fields**.
- **Sign out** clears cached Google tokens; the next sign-in asks you to choose an account again.
- Account/data deletion, retention limits, and a published privacy policy are tracked for the public release (GDPR/CCPA readiness).

## Roadmap
- [ ] Account & data deletion + privacy policy (GDPR/CCPA)
- [ ] Push notifications when the panel is closed (FCM)
- [ ] Subscriptions (Stripe) with free/premium limits
- [ ] File sharing
- [ ] Search friends by @handle
