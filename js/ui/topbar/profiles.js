// Profile picker — rename / dropdown switcher / delete trio living in the
// top-right of the topbar. Hooks straight into state.js's profile API.

import {
  getProfiles, getActiveProfileIndex, getActiveProfileName,
  switchProfile, createProfile, deleteProfile, renameProfile,
  PROFILES_MAX,
} from '../../core/state.js';
import { confirmModal, promptModal } from '../modal.js';

let els = null;
let menuOpen = false;
let onSwitch = null;   // optional callback fired *after* switching profiles

// Outside-click handler — installed once so we can toggle without leaks.
function onDocClick(e) {
  if (!menuOpen) return;
  if (els && els.picker && els.picker.contains(e.target)) return;
  closeMenu();
}

function openMenu() {
  if (!els) return;
  menuOpen = true;
  els.menu.hidden = false;
  els.toggle.setAttribute('aria-expanded', 'true');
  renderMenu();
}
function closeMenu() {
  if (!els) return;
  menuOpen = false;
  els.menu.hidden = true;
  els.toggle.setAttribute('aria-expanded', 'false');
}

function renderMenu() {
  if (!els || !menuOpen) return;
  const profiles = getProfiles();
  const active = getActiveProfileIndex();
  const atCap = profiles.length >= PROFILES_MAX;
  let html = '';
  for (const p of profiles) {
    const cls = 'profile-menu-item' + (p.index === active ? ' is-active' : '');
    html += `<li role="option" aria-selected="${p.index === active}">`
         +    `<button type="button" class="${cls}" data-idx="${p.index}">`
         +      `<span class="profile-menu-name">${escapeHtml(p.name)}</span>`
         +      (p.index === active ? '<span class="profile-menu-check">✓</span>' : '')
         +    `</button>`
         +  `</li>`;
  }
  html += `<li class="profile-menu-sep" role="separator"></li>`;
  html += `<li><button type="button" class="profile-menu-item profile-menu-new" data-act="new"${atCap ? ' disabled title="Profile cap reached (10)"' : ''}>`
       +    `<span class="profile-menu-name">+ New profile</span>`
       +  `</button></li>`;
  els.menu.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}

export function initProfilePicker(opts) {
  els = opts;
  onSwitch = typeof opts.onSwitch === 'function' ? opts.onSwitch : null;

  els.toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuOpen) closeMenu(); else openMenu();
  });

  els.menu.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-idx], button[data-act]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'new') {
      const idx = createProfile();
      closeMenu();
      if (idx != null) {
        switchProfile(idx);
        if (onSwitch) onSwitch();
      }
      return;
    }
    const idx = Number(btn.dataset.idx);
    closeMenu();
    if (idx !== getActiveProfileIndex()) {
      switchProfile(idx);
      if (onSwitch) onSwitch();
    }
  });

  els.rename.addEventListener('click', async () => {
    const current = getActiveProfileName();
    const name = await promptModal({
      title: 'Rename profile',
      message: 'Enter a new name for the active profile.',
      placeholder: current,
      confirmText: 'Rename',
      cancelText: 'Cancel',
    });
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === current) return;
    renameProfile(getActiveProfileIndex(), trimmed);
  });

  els.del.addEventListener('click', async () => {
    if (getProfiles().length <= 1) return;
    const name = getActiveProfileName();
    const ok = await confirmModal({
      title: `Delete profile "${name}"`,
      message: 'This permanently removes the profile and every level / plan stored in it. Other profiles are not affected.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    deleteProfile(getActiveProfileIndex());
    if (onSwitch) onSwitch();
  });

  document.addEventListener('click', onDocClick);
}

export function renderProfilePicker() {
  if (!els) return;
  els.activeName.textContent = getActiveProfileName();
  const onlyOne = getProfiles().length <= 1;
  els.del.disabled = onlyOne;
  els.del.title = onlyOne ? 'Cannot delete the only profile' : 'Delete the active profile';
  if (menuOpen) renderMenu();
}
