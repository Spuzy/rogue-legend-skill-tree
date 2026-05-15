// Themed confirmation modal. Replaces window.confirm() with a Promise-based
// dialog styled to match the rest of the simulator.
//
// Usage:
//   const ok = await confirmModal({ ... });
//   const text = await promptModal({ title, message, placeholder, ... });

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

// Prompt modal — shows a message plus a text input and returns the entered
// string (or null if cancelled).
export function promptModal(opts = {}) {
  const h = ensureHost();
  const title = opts.title || 'Input';
  const message = opts.message || '';
  const placeholder = opts.placeholder || '';
  const confirmText = opts.confirmText || 'OK';
  const cancelText = opts.cancelText || 'Cancel';

  h.querySelector('.app-modal-title').textContent = title;
  const body = h.querySelector('.app-modal-body');
  body.innerHTML = '';
  if (message) {
    const p = document.createElement('p');
    p.className = 'app-modal-msg';
    p.textContent = message;
    body.appendChild(p);
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.className = 'app-modal-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  body.appendChild(input);

  const confirmBtn = h.querySelector('.app-modal-confirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = 'app-modal-confirm';
  h.querySelector('.app-modal-cancel').textContent = cancelText;

  h.classList.remove('hidden');
  setTimeout(() => input.focus(), 0);

  if (activeReject) { const r = activeReject; activeReject = null; r(false); }

  return new Promise((resolve) => {
    activeReject = (ok) => resolve(ok ? input.value.trim() : null);
  });
}

// Copyable modal — shows a read-only text field the user can copy.
export function copyableModal(opts = {}) {
  const h = ensureHost();
  const title = opts.title || 'Share code';
  const message = opts.message || '';
  const value = opts.value || '';
  const dismissText = opts.dismissText || 'Close';

  h.querySelector('.app-modal-title').textContent = title;
  const body = h.querySelector('.app-modal-body');
  body.innerHTML = '';
  if (message) {
    const p = document.createElement('p');
    p.className = 'app-modal-msg';
    p.textContent = message;
    body.appendChild(p);
  }
  const row = document.createElement('div');
  row.className = 'app-modal-copy-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.value = value;
  input.className = 'app-modal-input';
  row.appendChild(input);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy';
  copyBtn.className = 'app-modal-copy-btn';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(value).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });
  });
  row.appendChild(copyBtn);
  body.appendChild(row);

  const cancelBtn = h.querySelector('.app-modal-cancel');
  const confirmBtn = h.querySelector('.app-modal-confirm');
  cancelBtn.hidden = true;
  confirmBtn.textContent = dismissText;
  confirmBtn.className = 'app-modal-confirm';

  h.classList.remove('hidden');
  setTimeout(() => { input.focus(); input.select(); }, 0);

  if (activeReject) { const r = activeReject; activeReject = null; r(false); }

  return new Promise((resolve) => {
    activeReject = () => {
      cancelBtn.hidden = false;
      resolve();
    };
  });
}

// Read-only info dialog. Single dismiss button, supports trusted HTML body
// (callers must NOT pass user-controlled HTML — content is author-authored).
export function infoModal(opts = {}) {
  const h = ensureHost();
  const title = opts.title || 'Info';
  const html  = opts.html || '';
  const dismissText = opts.dismissText || 'Got it';

  h.querySelector('.app-modal-title').textContent = title;
  const body = h.querySelector('.app-modal-body');
  body.innerHTML = html;

  // Hide cancel, repurpose confirm as a single dismiss button.
  const cancelBtn  = h.querySelector('.app-modal-cancel');
  const confirmBtn = h.querySelector('.app-modal-confirm');
  cancelBtn.hidden = true;
  confirmBtn.textContent = dismissText;
  confirmBtn.className = 'app-modal-confirm';

  // Widen the panel for long-form content.
  const panel = h.querySelector('.app-modal-panel');
  panel.classList.add('app-modal-wide');

  h.classList.remove('hidden');
  setTimeout(() => confirmBtn.focus(), 0);

  if (activeReject) { const r = activeReject; activeReject = null; r(false); }

  return new Promise((resolve) => {
    activeReject = (v) => {
      // Restore default modal shape for the next confirm() call.
      cancelBtn.hidden = false;
      panel.classList.remove('app-modal-wide');
      resolve(v);
    };
  });
}
