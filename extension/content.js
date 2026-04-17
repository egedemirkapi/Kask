(function () {
  let banner = null;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SHOW_MESSAGE') showBanner(message.text);
    if (message.type === 'SHOW_KICKED') showKickedOverlay();
  });

  function showBanner(text) {
    if (banner) banner.remove();
    banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
      background: #2563eb; color: white; padding: 12px 20px;
      font-family: system-ui; font-size: 15px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    banner.textContent = `📢 Teacher: ${text}`;
    const close = document.createElement('span');
    close.textContent = ' ✕';
    close.style.cssText = 'cursor:pointer; margin-left:12px; opacity:0.7;';
    close.onclick = () => banner && banner.remove();
    banner.appendChild(close);
    document.body.prepend(banner);
    setTimeout(() => banner && banner.remove(), 8000);
  }

  function showKickedOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999999;
      background: rgba(0,0,0,0.88); color: white;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui; flex-direction: column; gap: 12px;
    `;
    overlay.innerHTML = `
      <div style="font-size:52px">🚫</div>
      <div style="font-size:22px; font-weight:600;">You've been removed</div>
      <div style="font-size:15px; opacity:0.65;">Your teacher has ended your session access.</div>
    `;
    document.body.appendChild(overlay);
  }
})();
