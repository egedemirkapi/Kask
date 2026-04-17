const API_URL = 'https://api.classcontrol.app';
const WS_URL = 'wss://api.classcontrol.app';

let ws = null;
let studentId = null;
let sessionCode = null;
let isConnected = false;

// ── Tab & window monitoring ──────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(() => {
  if (!isConnected) return;
  sendToServer({ type: 'TAB_SWITCHED', student_id: studentId, timestamp: Date.now() });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (!isConnected) return;
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    sendToServer({ type: 'TAB_SWITCHED', student_id: studentId, timestamp: Date.now() });
  } else {
    sendToServer({ type: 'TAB_RESTORED', student_id: studentId });
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
    try {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    } catch {}
  };

  ws.onclose = () => {
    isConnected = false;
    studentId = null;
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
      chrome.storage.local.set({ connected: true, sessionCode });
      if (data.rules.locked_url) {
        applyLockUrl(data.rules.locked_url);
      } else if (data.rules.whitelist && data.rules.whitelist.length > 0) {
        applyWhitelist(data.rules.whitelist);
      }
      break;

    case 'SET_WHITELIST':
      applyWhitelist(data.urls);
      break;

    case 'LOCK_URL':
      if (data.url) applyLockUrl(data.url);
      else clearAllRules();
      break;

    case 'MESSAGE':
      notifyActiveTab({ type: 'SHOW_MESSAGE', text: data.text });
      break;

    case 'KICKED':
      notifyActiveTab({ type: 'SHOW_KICKED' });
      clearAllRules();
      if (ws) ws.close();
      chrome.storage.local.set({ connected: false });
      break;

    case 'SESSION_ENDED':
      clearAllRules();
      chrome.storage.local.set({ connected: false });
      if (ws) ws.close();
      break;
  }
}

// ── declarativeNetRequest rules ──────────────────────────────────────────────

async function applyWhitelist(domains) {
  if (!domains || domains.length === 0) {
    await clearAllRules();
    return;
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  const blockRule = {
    id: 1,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { resourceTypes: ['main_frame'], urlFilter: '|https://*' }
  };

  const allowRules = domains.map((domain, i) => ({
    id: 100 + i,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      requestDomains: [domain.replace(/^https?:\/\//, '').replace(/\/$/, '')],
      resourceTypes: ['main_frame']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: [blockRule, ...allowRules]
  });
}

async function applyLockUrl(url) {
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return; }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: [{
      id: 1,
      priority: 1,
      action: { type: 'redirect', redirect: { url } },
      condition: {
        resourceTypes: ['main_frame'],
        urlFilter: '|https://*',
        excludedRequestDomains: [hostname]
      }
    }]
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

function notifyActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
    }
  });
}

function sendToServer(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Popup message listener ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONNECT') {
    connect(message.name, message.roomCode);
    sendResponse({ ok: true });
  } else if (message.type === 'DISCONNECT') {
    clearAllRules();
    if (ws) ws.close();
    chrome.storage.local.set({ connected: false });
    sendResponse({ ok: true });
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ connected: isConnected, sessionCode });
  }
  return true;
});
