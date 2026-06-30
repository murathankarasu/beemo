# Chrome Web Store listing — copy/paste

Upload package: `beemo-0.1.0.zip` · Screenshots: `store/screenshot-1.png`, `store/screenshot-2.png`

## Store listing tab
- **Name**: Beemo — Send tabs, tab groups & text to a friend
- **Summary** (132): Send any tab, tab group, or note straight to a friend's Chrome in one shortcut — no copy-pasting into other apps.
- **Category**: Social & Communication
- **Language**: English
- **Detailed description**:
```
Beemo is the fastest way to share with a friend — Chrome to Chrome.

Found a page they have to see? Stop copying the link, opening WhatsApp, and pasting
it back. With Beemo you hit one shortcut, pick a friend, and it lands in their
browser instantly.

Send in one click:
• The tab you're on — or any link
• A whole tab group (trim the tabs you don't want first)
• Text, notes, and snippets — also from the right-click menu
• Optionally carry what you typed in a page's forms (passwords never included)

Like DMs, but for your browser:
• Add friends by email or invite link
• Anything sent to you appears in your Beemo inbox in real time
• Open a tab, copy text, or restore a whole group with a tap

Receiving is always free. Pro ($4.99/mo) unlocks unlimited sending and more.

No more "let me send you that link." Just Beemo it.
```

## Privacy tab
- **Single purpose**: Beemo lets a signed-in user send the current tab, a tab group, or a text note to a friend who also uses Beemo, directly between Chrome browsers.
- **Privacy policy URL**: https://beemo-ten.vercel.app/privacy.html  (or https://yourfavbeemo.com/privacy.html once the domain is live)

### Permission justifications
- **identity**: Sign in with Google to identify the user to their friends; we use only basic profile (name, email, photo).
- **tabs**: Read the title/URL of the tab the user chooses to send, and open tabs a friend sent.
- **tabGroups**: Read and recreate the tab group the user chooses to share.
- **storage**: Store the user's on-device key, pending invite, and small UI state locally.
- **sidePanel**: The whole Beemo UI runs in the Chrome side panel.
- **contextMenus**: Add a right-click "send to a friend" option for a page, link, or selected text.
- **scripting**: Only when the user ticks "include what I typed on this page", read non-password form fields on the current tab and refill them for the recipient.
- **notifications**: Notify the user when a friend sends them something.
- **Host permissions (optional, http/https)**: Requested at runtime, per site, only when the user enables form-fill — to read/refill form fields on that specific site. Never requested otherwise.

### Remote code
- **No.** All code (including Firebase) is bundled in the package. The only remote resource is the Google Fonts stylesheet (a font, not code).

### Data the extension collects
- Personally identifiable information — **Yes** (name, email, profile photo, to identify you to friends)
- Personal communications — **Yes** (the tabs/notes you send between friends)
- Website content — **Yes** (the tab URL/title and optional form values you choose to send)
- Location, health, financial/payment info, authentication (passwords), web browsing history — **No**
  (payments are handled by Lemon Squeezy; we never see card data)

### Certifications (check all)
- I do not sell or transfer user data to third parties outside the approved use cases
- I do not use or transfer user data for purposes unrelated to the item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending
- I comply with the Limited Use policy

## Distribution tab
- Free to install (Pro is billed outside the store via Lemon Squeezy)
- Visibility: Public · Regions: all (or your choice)
