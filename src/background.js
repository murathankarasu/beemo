// Service worker: kısayol, sağ tık menüsü ve side panel açma.
// Firebase burada YOK — tüm hesap/Firestore işleri side panel'de (document context).

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
  // Action ikonuna tıklayınca panel açılsın
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

async function stashPending(pending) {
  await chrome.storage.local.set({ [PENDING_KEY]: { ...pending, ts: Date.now() } });
}

async function openPanel(tabId, windowId) {
  try {
    if (tabId != null) await chrome.sidePanel.open({ tabId });
    else if (windowId != null) await chrome.sidePanel.open({ windowId });
  } catch (e) {
    console.warn("Couldn't open the side panel:", e);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "beemo-send-page") {
    await stashPending({ type: "tab", payload: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl } });
  } else if (info.menuItemId === "beemo-send-selection") {
    await stashPending({ type: "text", payload: { text: info.selectionText || "" } });
  } else if (info.menuItemId === "beemo-send-link") {
    await stashPending({ type: "tab", payload: { url: info.linkUrl, title: info.linkUrl } });
  }
  await openPanel(tab?.id, tab?.windowId);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-beemo") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await stashPending({ type: "tab", payload: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl } });
    await openPanel(tab.id, tab.windowId);
  }
});

// Panel "yeni gönderi geldi" derse bildirim göster.
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
