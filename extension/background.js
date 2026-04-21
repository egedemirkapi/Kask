const API_URL = 'https://api.classcontrol.app';
const WS_URL = 'wss://kask.onrender.com';

let ws = null;
let studentId = null;
let sessionCode = null;
let isConnected = false;

// Track current rules so we can decide if a tab switch is "allowed"
let currentWhitelist = [];
let currentLockedUrl = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isUrlAllowed(url) {
  if (!url) return false;
  if (url.startsWith('chrome-extension://')) return true;
  if (url.startsWith('chrome://')) return true;
  if (url === 'about:blank') return true;

  // If no restrictions are set, every URL triggers a switch alert
  // (teacher wants full visibility when no rules active)
  if (currentWhitelist.length === 0 && !currentLockedUrl) return false;

  let hostname;
  try { hostname = new URL(url).hostname; } catch { return false; }

  if (currentLockedUrl) {
    try {
      const lockedHost = new URL(currentLockedUrl).hostname;
      return hostname === lockedHost || hostname.endsWith('.' + lockedHost);
    } catch { return false; }
  }

  return currentWhitelist.some(domain =>
    hostname === domain || hostname.endsWith('.' + domain)
  );
}

function sendToServer(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function showOsNotification(title, message) {
  chrome.notifications.create('msg-' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: 2
  });
}

function notifyActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
  });
}

// ── Tab & window monitoring ──────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isConnected) return;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const url = tab.url || tab.pendingUrl || '';

    if (isUrlAllowed(url)) {
      // Student switched to an allowed site — restore status
      sendToServer({ type: 'TAB_RESTORED', student_id: studentId });
    } else {
      sendToServer({ type: 'TAB_SWITCHED', student_id: studentId, timestamp: Date.now() });
    }
  } catch {
    sendToServer({ type: 'TAB_SWITCHED', student_id: studentId, timestamp: Date.now() });
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (!isConnected) return;
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Chrome lost focus entirely — student switched to another app
    sendToServer({ type: 'TAB_SWITCHED', student_id: studentId, timestamp: Date.now() });
  } else {
    // Chrome regained focus — check if active tab is allowed
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      if (isUrlAllowed(url)) {
        sendToServer({ type: 'TAB_RESTORED', student_id: studentId });
      } else {
        sendToServer({ type: 'TAB_SWITCHED', student_id: studentId, timestamp: Date.now() });
      }
    });
  }
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (!isConnected || details.frameId !== 0) return;
  if (details.url.startsWith('chrome-extension://')) return;
  sendToServer({ type: 'URL_CHANGED', student_id: studentId, url: details.url });
}, { url: [{ schemes: ['http', 'https'] }] });

// ── WebSocket connection ─────────────────────────────────────────────────────

function connect(name, roomCode) {
  sessionCode = roomCode;
  ws = new WebSocket(`${WS_URL}/ws/student/${roomCode}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'JOINED', name, device: 'chrome' }));
  };

  ws.onmessage = (event) => {
    try { handleServerMessage(JSON.parse(event.data)); } catch {}
  };

  ws.onclose = () => {
    isConnected = false;
    studentId = null;
    currentWhitelist = [];
    currentLockedUrl = null;
    clearAllRules();
    chrome.storage.local.set({ connected: false });
  };

  ws.onerror = () => {
    isConnected = false;
    chrome.storage.local.set({ connected: false });
  };
}

// ── Server message handler ───────────────────────────────────────────────────

function handleServerMessage(data) {
  switch (data.type) {
    case 'SESSION_RULES':
      isConnected = true;
      currentWhitelist = data.rules.whitelist || [];
      currentLockedUrl = data.rules.locked_url || null;
      chrome.storage.local.set({ connected: true, sessionCode });
      if (currentLockedUrl) applyLockUrl(currentLockedUrl);
      else if (currentWhitelist.length > 0) applyWhitelist(currentWhitelist);
      break;

    case 'SET_WHITELIST':
      currentWhitelist = data.urls || [];
      currentLockedUrl = null;
      applyWhitelist(currentWhitelist);
      break;

    case 'LOCK_URL':
      currentLockedUrl = data.url || null;
      if (currentLockedUrl) applyLockUrl(currentLockedUrl);
      else clearAllRules();
      break;

    case 'MESSAGE':
      // Native OS notification — shows even when Chrome is minimized
      showOsNotification('📢 Teacher', data.text);
      // Also show in-page banner
      notifyActiveTab({ type: 'SHOW_MESSAGE', text: data.text });
      break;

    case 'KICKED':
      showOsNotification('ClassControl', 'Your teacher has removed you from the session.');
      notifyActiveTab({ type: 'SHOW_KICKED' });
      clearAllRules();
      ws?.close();
      chrome.storage.local.set({ connected: false });
      break;

    case 'SESSION_ENDED':
      showOsNotification('ClassControl', 'The session has ended.');
      clearAllRules();
      chrome.storage.local.set({ connected: false });
      ws?.close();
      break;
  }
}

// ── declarativeNetRequest rules ──────────────────────────────────────────────

function hostMatchesAllowed(hostname, allowed) {
  return allowed.some(d => hostname === d || hostname.endsWith('.' + d));
}

function tabIsControllable(tab) {
  if (!tab?.url) return false;
  return tab.url.startsWith('http://') || tab.url.startsWith('https://');
}

async function safeUpdateRules(spec, label) {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules(spec);
  } catch (e) {
    console.error('[ClassControl] rule update failed:', label, e);
    showOsNotification('ClassControl error', `Could not apply ${label}: ${e.message}`);
  }
}

async function applyWhitelist(rawDomains) {
  const domains = (rawDomains || []).map(d =>
    d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
  );
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  if (domains.length === 0) {
    await safeUpdateRules({ removeRuleIds: removeIds }, 'clear whitelist');
    return;
  }

  const blockedRedirect = chrome.runtime.getURL('blocked.html');
  const blockRule = {
    id: 1,
    priority: 1,
    action: { type: 'redirect', redirect: { url: blockedRedirect } },
    condition: { resourceTypes: ['main_frame'], urlFilter: '*' }
  };
  const allowRules = domains.map((domain, i) => ({
    id: 100 + i,
    priority: 2,
    action: { type: 'allow' },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] }
  }));

  await safeUpdateRules({ removeRuleIds: removeIds, addRules: [blockRule, ...allowRules] }, 'whitelist');

  // Actively redirect any currently-open tabs that aren't on an allowed domain
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tabIsControllable(tab)) continue;
      try {
        const host = new URL(tab.url).hostname;
        if (!hostMatchesAllowed(host, domains)) {
          chrome.tabs.update(tab.id, { url: blockedRedirect }).catch(() => {});
        }
      } catch { /* malformed URL */ }
    }
  });
}

async function applyLockUrl(url) {
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return; }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await safeUpdateRules({
    removeRuleIds: existing.map(r => r.id),
    addRules: [{
      id: 1,
      priority: 1,
      action: { type: 'redirect', redirect: { url } },
      condition: {
        resourceTypes: ['main_frame'],
        urlFilter: '*',
        excludedRequestDomains: [hostname]
      }
    }]
  }, 'lock URL');

  // Force every open tab to the locked URL immediately
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tabIsControllable(tab)) continue;
      try {
        const tabHost = new URL(tab.url).hostname;
        if (tabHost !== hostname && !tabHost.endsWith('.' + hostname)) {
          chrome.tabs.update(tab.id, { url }).catch(() => {});
        }
      } catch {
        chrome.tabs.update(tab.id, { url }).catch(() => {});
      }
    }
  });
}

async function clearAllRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(r => r.id)
    });
  }
}

// ── Popup message listener ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONNECT') {
    connect(message.name, message.roomCode);
    sendResponse({ ok: true });
  } else if (message.type === 'DISCONNECT') {
    clearAllRules();
    ws?.close();
    chrome.storage.local.set({ connected: false });
    sendResponse({ ok: true });
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ connected: isConnected, sessionCode });
  }
  return true;
});
