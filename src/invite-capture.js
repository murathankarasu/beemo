// Runs only on the Beemo landing page. Captures an invite code from the URL
// into the extension so it can be auto-redeemed once the user signs in.
(() => {
  try {
    const code = new URLSearchParams(location.search).get("invite");
    if (!code) return;
    chrome.storage.local.set({ beemo_pending_invite: code.trim().toUpperCase() });
    // Let the page show "Beemo detected — open the side panel to connect."
    document.documentElement.setAttribute("data-beemo-installed", "1");
    window.dispatchEvent(new CustomEvent("beemo-installed"));
  } catch {}
})();
