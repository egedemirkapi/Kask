const nameInput = document.getElementById('name-input');
const codeInput = document.getElementById('code-input');
const joinBtn = document.getElementById('join-btn');
const statusEl = document.getElementById('status');
const disconnectBtn = document.getElementById('disconnect-btn');

const API_URL = 'https://api.classcontrol.app';

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type;
  statusEl.style.display = 'block';
}

// Check if already connected on popup open
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
  if (res && res.connected) {
    showStatus(`Connected to ${res.sessionCode} ✓`, 'connected');
    document.getElementById('join-form').style.display = 'none';
    disconnectBtn.style.display = 'block';
  }
});

codeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

joinBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const roomCode = codeInput.value.trim().toUpperCase();

  if (!name) { showStatus('Enter your name', 'error'); return; }
  if (roomCode.length !== 6) { showStatus('Room code must be 6 characters', 'error'); return; }

  joinBtn.disabled = true;
  showStatus('Checking session...', 'info');

  try {
    const res = await fetch(`${API_URL}/session/${roomCode}/exists`);
    const data = await res.json();
    if (!data.exists) {
      showStatus('Session not found. Check the code.', 'error');
      joinBtn.disabled = false;
      return;
    }
  } catch {
    showStatus('Cannot reach server', 'error');
    joinBtn.disabled = false;
    return;
  }

  showStatus('Connecting...', 'info');
  chrome.runtime.sendMessage({ type: 'CONNECT', name, roomCode }, () => {
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
        if (res && res.connected) {
          showStatus(`Connected to ${roomCode} ✓`, 'connected');
          document.getElementById('join-form').style.display = 'none';
          disconnectBtn.style.display = 'block';
        } else {
          showStatus('Connection failed. Try again.', 'error');
          joinBtn.disabled = false;
        }
      });
    }, 1500);
  });
});

disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISCONNECT' }, () => location.reload());
});
