// Service worker: keyboard shortcut, right-click menu, and opening the side panel.
// Firebase lives in the side panel (a document context), not here.

const PENDING_KEY = "beemo_pending";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "beemo-send-page",
    title: "Beemo: send this tab to a friend",
    contexts: ["page", "action"],
  });
  chrome.contextMenus.create({
    id: "beemo-send-selection",
    title: "Beemo: send selected text to a friend",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "beemo-send-link",
    title: "Beemo: send this link to a friend",
    contexts: ["link"],
  });
  // Clicking the toolbar icon opens the panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// IMPORTANT: open the side panel synchronously inside the gesture (no await
// before it), otherwise Chrome rejects sidePanel.open() as "not a user gesture".
function openPanel(tab) {
  if (tab?.id != null) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  else if (tab?.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
}

// Stash what to send; the panel reads it on open (or live via storage.onChanged).
function stash(pending) {
  chrome.storage.local.set({ [PENDING_KEY]: { ...pending, ts: Date.now() } });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  openPanel(tab); // first — keep the gesture
  if (info.menuItemId === "beemo-send-page") {
    stash({ type: "tab", payload: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl } });
  } else if (info.menuItemId === "beemo-send-selection") {
    stash({ type: "text", payload: { text: info.selectionText || "" } });
  } else if (info.menuItemId === "beemo-send-link") {
    stash({ type: "tab", payload: { url: info.linkUrl, title: info.linkUrl } });
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-beemo") return;
  openPanel(tab); // first — keep the gesture
  if (tab) {
    stash({ type: "tab", payload: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl } });
  }
});

// Panel asks us to show an OS notification when a friend sends something.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "beemo-notify") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: msg.title || "Beemo",
      message: msg.message || "You've got a new item",
      priority: 1,
    });
  }
});
