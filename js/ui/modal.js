// Themed confirmation modal. Replaces window.confirm() with a Promise-based
// dialog styled to match the rest of the simulator.
//
// Usage:
//   const ok = await confirmModal({
//     title: 'Reset Adventure tree',
//     message: 'This clears every level and plan in the Adventure tree.',
//     items: ['• Adventure HP', '• Adventure ATK'],           // optional
//     confirmText: 'Reset', cancelText: 'Cancel',
//     tone: 'danger',                                          // 'danger' | 'normal' (default)
//   });

let host = null;
let activeReject = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'app-modal';
  host.className = 'app-modal hidden';
  host.innerHTML = `
    <div class="app-modal-backdrop"></div>
    <div class="app-modal-panel" role="dialog" aria-modal="true">
      <div class="app-modal-title"></div>
      <div class="app-modal-body"></div>
      <div class="app-modal-actions">
        <button type="button" class="app-modal-cancel">Cancel</button>
        <button type="button" class="app-modal-confirm">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(host);
  host.querySelector('.app-modal-backdrop').addEventListener('click', () => close(false));
  host.querySelector('.app-modal-cancel').addEventListener('click', () => close(false));
  host.querySelector('.app-modal-confirm').addEventListener('click', () => close(true));
  document.addEventListener('keydown', (e) => {
    if (host.classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    if (e.key === 'Enter')  { e.preventDefault(); close(true); }
  });
  return host;
}

function close(result) {
  if (!host) return;
  host.classList.add('hidden');
  const r = activeReject;
  activeReject = null;
  if (r) r(result);
}

export function confirmModal(opts = {}) {
  const h = ensureHost();
  const title  = opts.title || 'Confirm';
  const message = opts.message || '';
  const items  = Array.isArray(opts.items) ? opts.items : null;
  const confirmText = opts.confirmText || 'Confirm';
  const cancelText  = opts.cancelText  || 'Cancel';
  const tone = opts.tone === 'danger' ? 'danger' : '';

  h.querySelector('.app-modal-title').textContent = title;
  const body = h.querySelector('.app-modal-body');
  body.innerHTML = '';
  if (message) {
    const p = document.createElement('p');
    p.className = 'app-modal-msg';
    p.textContent = message;
    body.appendChild(p);
  }
  if (items && items.length) {
    const ul = document.createElement('ul');
    ul.className = 'app-modal-list';
    for (const it of items) {
      const li = document.createElement('li');
      li.textContent = it;
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }

  const confirmBtn = h.querySelector('.app-modal-confirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = 'app-modal-confirm' + (tone ? ' ' + tone : '');
  h.querySelector('.app-modal-cancel').textContent = cancelText;

  h.classList.remove('hidden');
  // Focus the confirm button for keyboard users.
  setTimeout(() => confirmBtn.focus(), 0);

  // If a previous modal is still open (shouldn't happen, but guard), resolve it.
  if (activeReject) { const r = activeReject; activeReject = null; r(false); }

  return new Promise((resolve) => { activeReject = resolve; });
}
