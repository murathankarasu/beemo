import { signIn, signOut, onAuth, trySilentSignIn } from "./auth.js";
import {
  findUserByEmail,
  sendFriendRequest,
  watchRequests,
  acceptRequest,
  declineRequest,
  watchFriends,
  sendItem,
  watchInbox,
  markRead,
  deleteInboxItem,
  createInvite,
  redeemInvite,
  watchMe,
  incrementSendUsage,
  sendsUsedToday,
} from "./db.js";
import { watchPro, startCheckout } from "./billing.js";
import {
  STRIPE_PRICE_ID,
  FREE_DAILY_SENDS,
  CHECKOUT_SUCCESS_URL,
  CHECKOUT_CANCEL_URL,
} from "./config.js";
const $ = (id) => document.getElementById(id);
const PENDING_KEY = "beemo_pending";
const PENDING_INVITE_KEY = "beemo_pending_invite";
const INVITE_BASE = "https://murathankarasu.github.io/Beemo/?invite=";

// Short, clear explanation shown under the type chips.
const TYPE_HINTS = {
  tab: "Sends the page you're currently viewing.",
  tabgroup: "Sends the tabs below — remove any you don't want before sending.",
  text: "Type or paste anything — a note, a link, or a snippet.",
};

const state = {
  user: null,
  friends: [],
  requests: [],
  inbox: [],
  selectedFriendUid: null,
  composeType: "tab",
  pendingTab: null, // tab coming from right-click / shortcut
  tabGroupTabs: null, // editable list for the "Tab group" composer
  pickerQuery: "",
  friendQuery: "",
  me: null, // own profile doc (plan + usage)
  subPro: false, // active Stripe subscription
  composeTabUrl: "", // URL of the tab shown in the composer (for form access)
  unsubs: [],
};

function isPro() {
  return state.subPro || state.me?.plan === "pro";
}
function sendsLeft() {
  return Math.max(0, FREE_DAILY_SENDS - sendsUsedToday(state.me));
}

const FRIEND_RENDER_CAP = 100; // keep the DOM small even with thousands of friends

// ---------------- Auth UI ----------------
$("signInBtn").addEventListener("click", async () => {
  try {
    await signIn();
  } catch (e) {
    setStatus($("sendStatus"), "Sign-in failed: " + e.message, "err");
  }
});
$("signOutBtn").addEventListener("click", () => signOut());

$("pickerSearch").addEventListener("input", (e) => {
  state.pickerQuery = e.target.value;
  renderFriendPicker();
});
$("friendSearch").addEventListener("input", (e) => {
  state.friendQuery = e.target.value;
  renderFriends();
});

onAuth(async (user) => {
  cleanup();
  state.user = user;
  if (user) {
    $("signedOut").classList.add("hidden");
    $("signedIn").classList.remove("hidden");
    $("userBox").classList.remove("hidden");
    $("userAvatar").src = user.photoURL || "";
    startWatchers();
    await loadPending();
    await checkPendingInvite();
  } else {
    $("signedOut").classList.remove("hidden");
    $("signedIn").classList.add("hidden");
    $("userBox").classList.add("hidden");
  }
});

trySilentSignIn();

function cleanup() {
  state.unsubs.forEach((u) => u && u());
  state.unsubs = [];
}

function startWatchers() {
  const uid = state.user.uid;
  state.unsubs.push(
    watchFriends(uid, (friends) => {
      state.friends = friends;
      renderFriends();
      renderFriendPicker();
    }),
    watchRequests(uid, (requests) => {
      state.requests = requests;
      renderRequests();
    }),
    watchInbox(uid, (inbox) => {
      const prevUnread = state.inbox.filter((m) => !m.read).length;
      state.inbox = inbox;
      renderInbox();
      const unread = inbox.filter((m) => !m.read).length;
      if (unread > prevUnread) notifyNew(inbox[0]);
    }),
    watchMe(uid, (me) => {
      state.me = me;
      renderUsage();
    }),
    watchPro(uid, (pro) => {
      state.subPro = pro;
      renderUsage();
    })
  );
}

function renderUsage() {
  const line = $("usageLine");
  if (!line) return;
  if (isPro()) {
    line.innerHTML = `<span class="pro-badge">PRO</span> Unlimited sending`;
    return;
  }
  const left = sendsLeft();
  line.innerHTML = `${left}/${FREE_DAILY_SENDS} free sends left today · <a href="#" id="goProLink">Go Pro</a>`;
  line.querySelector("#goProLink").addEventListener("click", (e) => {
    e.preventDefault();
    openPaywall();
  });
}

// ---------------- Tabs ----------------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    for (const name of ["send", "friends", "inbox"]) {
      $("tab-" + name).classList.toggle("hidden", name !== btn.dataset.tab);
    }
  });
});

// ---------------- Live tab refresh ----------------
// Keep the "This tab" / "Tab group" preview in sync with the real browser,
// even on in-page (SPA) navigations where the page never fully reloads.
function refreshTabPreview() {
  if (!state.user) return;
  if (state.composeType === "tab") {
    state.pendingTab = null; // stale right-click/shortcut capture no longer applies
    renderComposeBody();
  }
}
chrome.tabs.onActivated.addListener(refreshTabPreview);
chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title || changeInfo.favIconUrl)) {
    refreshTabPreview();
  }
});
// Returning focus to the panel also re-reads the current tab.
window.addEventListener("focus", refreshTabPreview);

// ---------------- Compose ----------------
$("typeChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll("#typeChips .chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  state.composeType = chip.dataset.type;
  if (state.composeType === "tabgroup") state.tabGroupTabs = null; // re-read fresh on each entry
  renderComposeBody();
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---------------- Form transfer (opt-in, passwords excluded) ----------------
function originPattern(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

async function ensureOrigin(url) {
  const pattern = originPattern(url);
  if (!pattern) return false;
  const has = await chrome.permissions.contains({ origins: [pattern] });
  if (has) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

// Injected into the page — reads visible field values. Passwords/hidden excluded.
// Builds a stable CSS selector for each field so even id-less SPA inputs are caught.
function captureFormFields() {
  const skip = new Set(["password", "hidden", "file", "submit", "button", "image", "reset"]);
  const cssPath = (el) => {
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let sel = node.nodeName.toLowerCase();
      if (node.name) {
        parts.unshift(`${sel}[name="${CSS.escape(node.name)}"]`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter((c) => c.nodeName === node.nodeName);
        if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
      node = parent;
    }
    return parts.join(" > ");
  };
  const out = [];
  for (const el of document.querySelectorAll("input, textarea, select")) {
    if (out.length >= 200) break;
    const type = (el.type || "text").toLowerCase();
    if (skip.has(type) || el.disabled) continue;
    const sel = cssPath(el);
    if (!sel) continue;
    if (type === "checkbox" || type === "radio") {
      out.push({ sel, type, value: el.value, checked: el.checked });
    } else {
      if (el.value == null || el.value === "") continue;
      out.push({ sel, type, value: String(el.value).slice(0, 5000) });
    }
  }
  return out;
}

// Injected into the opened page — restores values. Uses the native value setter
// so React/Vue controlled inputs register the change, and retries for late forms.
function restoreFormFields(fields) {
  const setVal = (el, value) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const apply = () => {
    for (const f of fields) {
      let el = null;
      try {
        el = document.querySelector(f.sel);
      } catch {}
      if (!el) continue;
      if (f.type === "checkbox" || f.type === "radio") {
        el.checked = !!f.checked;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        setVal(el, f.value);
      }
    }
  };
  apply();
  let tries = 0;
  const iv = setInterval(() => {
    apply();
    if (++tries >= 6) clearInterval(iv);
  }, 500);
}

async function captureCurrentForm(tab) {
  const url = tab?.url;
  if (!tab?.id || !url) return null;
  const pat = originPattern(url);
  if (!pat) return null;
  const has = await chrome.permissions.contains({ origins: [pat] });
  if (!has) return null;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: captureFormFields });
    return res?.result || null;
  } catch {
    return null;
  }
}

// Open a received tab; if it carried form data, re-fill the page once it loads.
async function openSharedTab(payload) {
  const hasForm = !!(payload.formData && payload.formData.length);
  let granted = false;
  if (hasForm) {
    const pat = originPattern(payload.url);
    granted = pat ? await chrome.permissions.request({ origins: [pat] }) : false; // first await keeps the gesture
  }
  const tab = await chrome.tabs.create({ url: payload.url });
  if (hasForm && granted) {
    await waitForTabComplete(tab.id);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: restoreFormFields,
        args: [payload.formData],
      });
    } catch {}
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const done = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(done);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(done);
    // safety timeout
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(done);
      resolve();
    }, 8000);
  });
}

async function renderComposeBody() {
  $("typeHint").textContent = TYPE_HINTS[state.composeType] || "";
  const body = $("composeBody");
  body.innerHTML = "";
  if (state.composeType === "tab") {
    const tab = state.pendingTab || (await getCurrentTab());
    body.appendChild(tabPreview(tab));
    state.composeTabUrl = tab.url || tab.payload?.url || "";
    const wrap = document.createElement("label");
    wrap.className = "checkrow";
    wrap.innerHTML = `<input type="checkbox" id="includeForm" /> <span>Include what I typed on this page <small class="muted">(forms — never passwords)</small></span>`;
    body.appendChild(wrap);
    // Only the live current tab can be read — disable for right-click/shortcut captures.
    if (state.pendingTab) {
      const includeEl = wrap.querySelector("#includeForm");
      includeEl.disabled = true;
      wrap.title = "Available when sending the tab you're currently on.";
    }
  } else if (state.composeType === "tabgroup") {
    if (!state.tabGroupTabs) state.tabGroupTabs = await getCurrentGroupTabs();
    const list = document.createElement("div");
    list.className = "grouptabs";
    const renderList = () => {
      list.innerHTML = "";
      if (!state.tabGroupTabs.length) {
        list.innerHTML = `<p class="muted small">No tabs left — add some back by switching tabs, or pick another type.</p>`;
      }
      state.tabGroupTabs.forEach((t, i) => {
        const row = document.createElement("div");
        row.className = "grouptab";
        row.innerHTML = `${
          t.favIconUrl ? `<img src="${t.favIconUrl}"/>` : `<span class="fav"></span>`
        }<span class="gt-title">${escapeHtml(t.title || t.url)}</span><button class="gt-x" title="Remove from group" aria-label="Remove">×</button>`;
        row.querySelector(".gt-x").addEventListener("click", () => {
          state.tabGroupTabs.splice(i, 1);
          renderList();
          updateSendEnabled();
        });
        list.appendChild(row);
      });
    };
    renderList();
    body.appendChild(list);
  } else if (state.composeType === "text") {
    const ta = document.createElement("textarea");
    ta.id = "textInput";
    ta.placeholder = "Type your message…";
    if (state.pendingTab?.text) ta.value = state.pendingTab.text;
    body.appendChild(ta);
  }
  updateSendEnabled();
}

function tabPreview(tab) {
  const div = document.createElement("div");
  div.className = "preview";
  const fav = tab?.favIconUrl || tab?.payload?.favIconUrl || "";
  div.innerHTML = `${fav ? `<img src="${fav}" />` : ""}<div class="t"><b>${escapeHtml(
    tab?.title || "Tab"
  )}</b><span>${escapeHtml(tab?.url || "")}</span></div>`;
  return div;
}

async function getCurrentGroupTabs() {
  const active = await getCurrentTab();
  if (active && active.groupId != null && active.groupId !== -1) {
    const tabs = await chrome.tabs.query({ groupId: active.groupId });
    return tabs.map((t) => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl }));
  }
  // No group → all tabs in the current window
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map((t) => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl }));
}

function filterFriends(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return state.friends;
  return state.friends.filter(
    (f) =>
      (f.displayName || "").toLowerCase().includes(q) ||
      (f.handle || "").toLowerCase().includes(q)
  );
}

function moreNote(hidden) {
  const p = document.createElement("p");
  p.className = "muted small count-more";
  p.textContent = `+${hidden} more — search to narrow down`;
  return p;
}

function renderFriendPicker() {
  const picker = $("friendPicker");
  $("pickerSearch").classList.toggle("hidden", state.friends.length <= 8);
  if (!state.friends.length) {
    picker.innerHTML = `<p class="muted small" id="noFriendsHint">Add a friend first, in the Friends tab →</p>`;
    return;
  }
  const filtered = filterFriends(state.pickerQuery);
  picker.innerHTML = "";
  if (!filtered.length) {
    picker.innerHTML = `<p class="muted small">No friend matches that.</p>`;
    return;
  }
  for (const f of filtered.slice(0, FRIEND_RENDER_CAP)) {
    const row = document.createElement("div");
    row.className = "friend-row" + (state.selectedFriendUid === f.uid ? " selected" : "");
    row.innerHTML = `${f.photoURL ? `<img src="${f.photoURL}"/>` : `<img/>`}<div class="name">${escapeHtml(
      f.displayName
    )}</div>`;
    row.addEventListener("click", () => {
      state.selectedFriendUid = f.uid;
      renderFriendPicker();
      updateSendEnabled();
    });
    picker.appendChild(row);
  }
  if (filtered.length > FRIEND_RENDER_CAP) picker.appendChild(moreNote(filtered.length - FRIEND_RENDER_CAP));
}

function updateSendEnabled() {
  let ok = state.selectedFriendUid && state.friends.length;
  if (state.composeType === "tabgroup" && !(state.tabGroupTabs && state.tabGroupTabs.length)) ok = false;
  $("sendBtn").disabled = !ok;
}

$("sendBtn").addEventListener("click", async () => {
  const btn = $("sendBtn");
  const status = $("sendStatus");
  const friend = state.friends.find((f) => f.uid === state.selectedFriendUid);
  if (!friend) return;
  // Paywall: free plan can only send a few times a day. Receiving stays free.
  if (!isPro() && sendsLeft() <= 0) {
    openPaywall();
    return;
  }
  // If "include form data" is on, ask for site access now — this is the first
  // await, so the click's user gesture is still valid for the permission prompt.
  if (
    state.composeType === "tab" &&
    !state.pendingTab &&
    document.getElementById("includeForm")?.checked
  ) {
    const pat = originPattern(state.composeTabUrl || "");
    if (pat) {
      try {
        await chrome.permissions.request({ origins: [pat] });
      } catch {}
    }
  }
  btn.disabled = true;
  setStatus(status, "Sending…", "");
  try {
    const item = await buildItem(friend);
    await sendItem(state.user, friend.uid, item);
    if (!isPro()) await incrementSendUsage(state.user.uid, state.me);
    setStatus(status, `✓ Sent to ${friend.displayName}`, "ok");
    await clearPending();
    if (state.composeType === "text") $("textInput").value = "";
    if (state.composeType === "tabgroup") state.tabGroupTabs = null;
  } catch (e) {
    setStatus(status, "Error: " + e.message, "err");
  } finally {
    btn.disabled = false;
  }
});

// ---------------- Paywall ----------------
function openPaywall() {
  $("paywall").classList.remove("hidden");
}
function closePaywall() {
  $("paywall").classList.add("hidden");
}
$("paywallClose").addEventListener("click", closePaywall);
$("paywallLater").addEventListener("click", closePaywall);
$("paywallUpgrade").addEventListener("click", async () => {
  const btn = $("paywallUpgrade");
  if (!STRIPE_PRICE_ID || STRIPE_PRICE_ID.includes("REPLACE_ME")) {
    setStatus($("paywallStatus"), "Billing isn't set up yet — coming soon.", "err");
    return;
  }
  btn.disabled = true;
  setStatus($("paywallStatus"), "Opening secure checkout…", "");
  try {
    const url = await startCheckout(
      state.user.uid,
      STRIPE_PRICE_ID,
      CHECKOUT_SUCCESS_URL,
      CHECKOUT_CANCEL_URL
    );
    chrome.tabs.create({ url });
    setStatus($("paywallStatus"), "Continue in the new tab to finish.", "ok");
  } catch (e) {
    setStatus($("paywallStatus"), "Error: " + e.message, "err");
  } finally {
    btn.disabled = false;
  }
});

async function buildItem(friend) {
  if (state.composeType === "tab") {
    const tab = state.pendingTab || (await getCurrentTab());
    const payload = {
      url: tab.url || tab.payload?.url,
      title: tab.title || tab.payload?.title || tab.url,
      favIconUrl: tab.favIconUrl || tab.payload?.favIconUrl || "",
    };
    if (!state.pendingTab && document.getElementById("includeForm")?.checked) {
      const fields = await captureCurrentForm(tab);
      if (fields?.length) payload.formData = fields;
    }
    return { type: "tab", payload };
  }
  if (state.composeType === "tabgroup") {
    const tabs = state.tabGroupTabs || (await getCurrentGroupTabs());
    if (!tabs.length) throw new Error("No tabs to send");
    return { type: "tabgroup", payload: { tabs } };
  }
  if (state.composeType === "text") {
    const text = $("textInput").value.trim();
    if (!text) throw new Error("Message is empty");
    return { type: "text", payload: { text } };
  }
  throw new Error("Unknown type");
}

// ---------------- Friends ----------------
$("addBtn").addEventListener("click", async () => {
  const email = $("addEmail").value.trim();
  const status = $("addStatus");
  $("inviteOut").classList.add("hidden");
  if (!email) return;
  setStatus(status, "Searching…", "");
  try {
    const target = await findUserByEmail(email);
    if (!target) {
      // Not on Beemo yet → create an invite link to share (this is the viral loop).
      const code = await createInvite(state.user, email);
      showInvite(code, email);
      setStatus(status, "", "");
      return;
    }
    if (target.uid === state.user.uid) return setStatus(status, "That's you :)", "err");
    if (state.friends.some((f) => f.uid === target.uid))
      return setStatus(status, "You're already friends.", "err");
    await sendFriendRequest(state.user, target.uid);
    setStatus(status, `✓ Friend request sent to ${target.displayName}`, "ok");
    $("addEmail").value = "";
  } catch (e) {
    setStatus(status, "Error: " + e.message, "err");
  }
});

function showInvite(code, email) {
  const link = INVITE_BASE + code;
  const out = $("inviteOut");
  out.classList.remove("hidden");
  out.innerHTML = `
    <p class="muted small">${escapeHtml(email)} isn't on Beemo yet. Send them this link — once they install &amp; sign in, you're connected automatically.</p>
    <div class="invite-link"><span class="invite-url">${escapeHtml(link)}</span><button id="copyInvite">Copy</button></div>
    <p class="muted small">Or have them enter code <b>${escapeHtml(code)}</b> below.</p>`;
  out.querySelector("#copyInvite").addEventListener("click", (e) => {
    copy(link);
    e.target.textContent = "Copied ✓";
  });
}

// Join via a code someone shared.
$("redeemBtn").addEventListener("click", async () => {
  const code = $("redeemCode").value.trim();
  const status = $("redeemStatus");
  if (!code) return;
  setStatus(status, "Connecting…", "");
  try {
    const inviter = await redeemInvite(state.user, code);
    setStatus(status, `✓ Connected with ${inviter.displayName}`, "ok");
    $("redeemCode").value = "";
  } catch (e) {
    setStatus(status, "Error: " + e.message, "err");
  }
});

// Auto-redeem an invite captured from the landing page (deferred deep link).
async function checkPendingInvite() {
  const { [PENDING_INVITE_KEY]: code } = await chrome.storage.local.get(PENDING_INVITE_KEY);
  if (!code) return;
  await chrome.storage.local.remove(PENDING_INVITE_KEY);
  try {
    const inviter = await redeemInvite(state.user, code);
    setStatus($("redeemStatus"), `✓ Connected with ${inviter.displayName}`, "ok");
    document.querySelector('.tab[data-tab="friends"]').click();
  } catch {}
}

function renderRequests() {
  const wrap = $("requestsWrap");
  const list = $("requestsList");
  if (!state.requests.length) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  list.innerHTML = "";
  for (const r of state.requests) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="head">${
      r.fromPhoto ? `<img src="${r.fromPhoto}"/>` : `<img/>`
    }<div class="who">${escapeHtml(r.fromName)} wants to be your friend</div></div>
      <div class="actions"><button data-act="accept">Accept</button><button data-act="decline">Decline</button></div>`;
    card.querySelector('[data-act="accept"]').addEventListener("click", async () => {
      try {
        await acceptRequest(state.user, r.fromUid);
      } catch (e) {
        alert("Couldn't accept: " + e.message);
      }
    });
    card.querySelector('[data-act="decline"]').addEventListener("click", () =>
      declineRequest(state.user.uid, r.fromUid)
    );
    list.appendChild(card);
  }
}

function renderFriends() {
  const list = $("friendsList");
  $("friendSearch").classList.toggle("hidden", state.friends.length <= 8);
  if (!state.friends.length) {
    list.innerHTML = `<p class="muted small">No friends yet.</p>`;
    return;
  }
  const filtered = filterFriends(state.friendQuery);
  list.innerHTML = "";
  if (!filtered.length) {
    list.innerHTML = `<p class="muted small">No friend matches that.</p>`;
    return;
  }
  for (const f of filtered.slice(0, FRIEND_RENDER_CAP)) {
    const row = document.createElement("div");
    row.className = "friend-row";
    row.innerHTML = `${f.photoURL ? `<img src="${f.photoURL}"/>` : `<img/>`}<div class="name">${escapeHtml(
      f.displayName
    )}${f.handle ? `<small>@${escapeHtml(f.handle)}</small>` : ""}</div>`;
    list.appendChild(row);
  }
  if (filtered.length > FRIEND_RENDER_CAP) list.appendChild(moreNote(filtered.length - FRIEND_RENDER_CAP));
}

// ---------------- Inbox ----------------
function renderInbox() {
  const list = $("inboxList");
  const unread = state.inbox.filter((m) => !m.read).length;
  const badge = $("inboxBadge");
  badge.textContent = unread;
  badge.classList.toggle("hidden", unread === 0);

  if (!state.inbox.length) {
    list.innerHTML = `<p class="muted small">Your inbox is empty. Items friends send you show up here instantly.</p>`;
    return;
  }
  list.innerHTML = "";
  for (const m of state.inbox) {
    list.appendChild(inboxCard(m));
  }
}

function inboxCard(m) {
  const card = document.createElement("div");
  card.className = "card" + (m.read ? "" : " unread");
  const typeLabel =
    { tab: "tab", tabgroup: "tab group", text: "text", password: "password" }[m.type] || m.type;
  const head = document.createElement("div");
  head.className = "head";
  head.innerHTML = `${m.fromPhoto ? `<img src="${m.fromPhoto}"/>` : `<img/>`}<span class="who">${escapeHtml(
    m.fromName
  )}</span><span class="type-pill">${typeLabel}</span>`;
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "body";
  const actions = document.createElement("div");
  actions.className = "actions";

  if (m.type === "tab") {
    const hasForm = !!(m.payload.formData && m.payload.formData.length);
    body.innerHTML = `<b>${escapeHtml(m.payload.title || "")}</b><div class="muted small">${escapeHtml(
      m.payload.url || ""
    )}</div>${hasForm ? `<div class="muted small">📝 Includes ${m.payload.formData.length} pre-filled field${m.payload.formData.length === 1 ? "" : "s"}</div>` : ""}`;
    actions.appendChild(actBtn("Open", () => openSharedTab(m.payload)));
  } else if (m.type === "tabgroup") {
    body.innerHTML = `<b>${m.payload.tabs.length} tab${
      m.payload.tabs.length === 1 ? "" : "s"
    }</b><div class="muted small">${m.payload.tabs
      .map((t) => escapeHtml(t.title))
      .slice(0, 4)
      .join(" · ")}</div>`;
    actions.appendChild(
      actBtn("Open all", async () => {
        const ids = [];
        for (const t of m.payload.tabs) {
          const nt = await chrome.tabs.create({ url: t.url, active: false });
          ids.push(nt.id);
        }
        try {
          const groupId = await chrome.tabs.group({ tabIds: ids });
          await chrome.tabGroups.update(groupId, { title: m.fromName });
        } catch {}
      })
    );
  } else if (m.type === "text") {
    body.innerHTML = `<div>${escapeHtml(m.payload.text)}</div>`;
    actions.appendChild(actBtn("Copy", () => copy(m.payload.text)));
  }

  if (!m.read) actions.appendChild(actBtn("Mark read", () => markRead(state.user.uid, m.id)));
  actions.appendChild(actBtn("Delete", () => deleteInboxItem(state.user.uid, m.id)));

  card.append(body, actions);
  return card;
}

function actBtn(label, fn) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}

// ---------------- Pending (right-click / shortcut) ----------------
async function loadPending() {
  const { [PENDING_KEY]: p } = await chrome.storage.local.get(PENDING_KEY);
  if (!p) {
    renderComposeBody();
    return;
  }
  // Ignore if older than 60s
  if (Date.now() - (p.ts || 0) < 60000) {
    if (p.type === "text") {
      selectChip("text");
      state.pendingTab = { text: p.payload.text };
    } else {
      selectChip("tab");
      state.pendingTab = { ...p.payload, payload: p.payload };
    }
  }
  await clearPending();
  renderComposeBody();
}
function selectChip(type) {
  state.composeType = type;
  document.querySelectorAll("#typeChips .chip").forEach((c) =>
    c.classList.toggle("active", c.dataset.type === type)
  );
}
async function clearPending() {
  await chrome.storage.local.remove(PENDING_KEY);
}

// ---------------- Utils ----------------
function notifyNew(m) {
  if (!m) return;
  chrome.runtime.sendMessage({
    type: "beemo-notify",
    title: `${m.fromName} sent you something`,
    message: { tab: "A tab", tabgroup: "A tab group", text: "Some text" }[m.type] || "An item",
  });
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Draw the initial compose body
renderComposeBody();
