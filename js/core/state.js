// Player state: current owned level + planned target per node. Persisted to
// localStorage.
//
// v2 storage shape (multi-profile):
//   {
//     activeProfile: 0,
//     profiles: [ { name, current:{nodeId:lvl}, planned:{nodeId:lvl} }, ... up to 10 ],
//     filter: { active, accumulative, books, gems },   // shared across profiles
//     activeTree: 'adventure',                          // shared across profiles
//   }
//
// `state.current` / `state.planned` always point at the *active* profile's
// objects so legacy callers keep working unchanged. Switching profiles
// reassigns these references and then notify()s.

const KEY    = 'rogue_legend_skill_sim_v2';
const KEY_V1 = 'rogue_legend_skill_sim_v1';
const MAX_PROFILES = 10;

function emptyProfile(name) {
  return { name: name || 'Profile 1', current: {}, planned: {} };
}

function initial() {
  return {
    activeTree: 'adventure',
    activeProfile: 0,
    profiles: [emptyProfile('Profile 1')],
    filter: { active: false, accumulative: true, books: 0, gems: 0 },
  };
}

function migrateFromV1(v1) {
  // v1 had `current` / `planned` at the top level. Promote it to profile 0
  // and keep filter + activeTree.
  const base = initial();
  if (v1 && typeof v1 === 'object') {
    base.profiles[0].current = (v1.current && typeof v1.current === 'object') ? v1.current : {};
    base.profiles[0].planned = (v1.planned && typeof v1.planned === 'object') ? v1.planned : {};
    if (v1.activeTree) base.activeTree = v1.activeTree;
    if (v1.filter && typeof v1.filter === 'object') {
      base.filter = { ...base.filter, ...v1.filter };
    }
  }
  return base;
}

function sanitize(parsed) {
  const base = initial();
  if (!parsed || typeof parsed !== 'object') return base;
  const out = { ...base, ...parsed, filter: { ...base.filter, ...(parsed.filter || {}) } };
  if (!Array.isArray(out.profiles) || out.profiles.length === 0) {
    out.profiles = [emptyProfile('Profile 1')];
  }
  out.profiles = out.profiles.slice(0, MAX_PROFILES).map((p, i) => ({
    name: (p && typeof p.name === 'string' && p.name.trim()) ? p.name : `Profile ${i + 1}`,
    current: (p && p.current && typeof p.current === 'object') ? p.current : {},
    planned: (p && p.planned && typeof p.planned === 'object') ? p.planned : {},
  }));
  if (typeof out.activeProfile !== 'number'
      || out.activeProfile < 0
      || out.activeProfile >= out.profiles.length) {
    out.activeProfile = 0;
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
    // Try migrating from the legacy v1 single-profile store.
    const v1 = localStorage.getItem(KEY_V1);
    if (v1) {
      try { return sanitize(migrateFromV1(JSON.parse(v1))); } catch { /* fall through */ }
    }
    return initial();
  } catch { return initial(); }
}

export const state = load();
// Live references onto the active profile's progress maps. Reassigned by
// switchProfile / deleteProfile / loadSharedState.
state.current = state.profiles[state.activeProfile].current;
state.planned = state.profiles[state.activeProfile].planned;

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() {
  save();
  listeners.forEach(fn => fn());
}

function save() {
  try {
    // `search` is intentionally ephemeral. `current` / `planned` are stripped
    // because they are live aliases onto `profiles[activeProfile]` — saving
    // them would just duplicate that data.
    const { search, current, planned, ...persisted } = state;
    localStorage.setItem(KEY, JSON.stringify(persisted));
  } catch {}
}

export function getCurrent(nodeId) { return state.current[nodeId] || 0; }
export function getPlanned(nodeId) { return Math.max(state.planned[nodeId] || 0, getCurrent(nodeId)); }

export function setCurrent(node, level) {
  level = Math.max(0, Math.min(node.maxLevel, level));
  state.current[node.nodeId] = level;
  // Setting the current level always resets the plan to match. A higher
  // pre-existing plan is intentionally cleared (no "ghost plan" stays around
  // when the player picks a smaller current level).
  state.planned[node.nodeId] = level;
  notify();
}

export function setPlanned(node, level) {
  level = Math.max(getCurrent(node.nodeId), Math.min(node.maxLevel, level));
  state.planned[node.nodeId] = level;
  notify();
}

export function setActiveTree(treeId) {
  state.activeTree = treeId;
  notify();
}

export function setFilter(patch) {
  state.filter = { ...state.filter, ...patch };
  notify();
}

// Ephemeral search query — not persisted, just kicks listeners.
state.search = '';
export function setSearch(q) {
  state.search = (q || '').toString();
  notify();
}

export function loadSharedState(current, planned) {
  // Write into the active profile and refresh the live aliases.
  state.profiles[state.activeProfile].current = current;
  state.profiles[state.activeProfile].planned = planned;
  state.current = current;
  state.planned = planned;
  notify();
}

// Same as loadSharedState but targets a specific profile slot. Used by the
// "Load into new profile" branch of the Load dialog.
export function loadSharedStateInto(idx, current, planned) {
  if (idx < 0 || idx >= state.profiles.length) return;
  state.profiles[idx].current = current;
  state.profiles[idx].planned = planned;
  if (idx === state.activeProfile) {
    state.current = current;
    state.planned = planned;
  }
  notify();
}

export function resetAll() {
  // Wipe progress only. Filter state (toggle + values) is preserved so the
  // checkmark stays the source of truth — no off/on dance needed afterwards.
  for (const p of state.profiles) { p.current = {}; p.planned = {}; }
  state.current = state.profiles[state.activeProfile].current;
  state.planned = state.profiles[state.activeProfile].planned;
  notify();
}

// Reset only the nodes belonging to a specific tree id (e.g. 'adventure' or
// 'specialization'). Imported lazily by callers to avoid a circular import
// with data.js.
export async function resetTree(treeId) {
  const { TREES } = await import('./data.js');
  const tree = TREES[treeId];
  if (!tree) return;
  for (const node of tree.nodes.values()) {
    delete state.current[node.nodeId];
    delete state.planned[node.nodeId];
  }
  notify();
}

// Clear only planned levels for every node belonging to `treeId`. Current
// owned levels are left untouched.
export async function removePlannedTree(treeId) {
  const { TREES } = await import('./data.js');
  const tree = TREES[treeId];
  if (!tree) return;
  for (const node of tree.nodes.values()) {
    delete state.planned[node.nodeId];
  }
  notify();
}

// ────────────────────────────────────────────────────────────────────────────
// Profile management
// ────────────────────────────────────────────────────────────────────────────

export const PROFILES_MAX = MAX_PROFILES;

export function getProfiles() {
  // Defensive shallow copy — callers should treat the result as read-only.
  return state.profiles.map((p, i) => ({ name: p.name, index: i }));
}

export function getActiveProfileIndex() { return state.activeProfile; }
export function getActiveProfileName()  { return state.profiles[state.activeProfile].name; }

export function switchProfile(idx) {
  if (idx === state.activeProfile) return;
  if (idx < 0 || idx >= state.profiles.length) return;
  state.activeProfile = idx;
  state.current = state.profiles[idx].current;
  state.planned = state.profiles[idx].planned;
  notify();
}

function nextProfileName() {
  // Use the lowest "Profile N" name not already taken so renames-then-new
  // doesn't pick weird numbers.
  const taken = new Set(state.profiles.map(p => p.name));
  for (let i = 1; i <= MAX_PROFILES + 1; i++) {
    const candidate = `Profile ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `Profile ${state.profiles.length + 1}`;
}

// Returns the new profile's index, or null if already at the MAX_PROFILES cap.
export function createProfile(name) {
  if (state.profiles.length >= MAX_PROFILES) return null;
  const clean = (name && String(name).trim()) || nextProfileName();
  state.profiles.push(emptyProfile(clean));
  notify();
  return state.profiles.length - 1;
}

// Refuses to delete the last remaining profile. If the active profile is the
// one being removed, the previous slot becomes active (or 0 if removing 0).
export function deleteProfile(idx) {
  if (state.profiles.length <= 1) return false;
  if (idx < 0 || idx >= state.profiles.length) return false;
  state.profiles.splice(idx, 1);
  if (state.activeProfile >= state.profiles.length) {
    state.activeProfile = state.profiles.length - 1;
  } else if (idx < state.activeProfile) {
    state.activeProfile -= 1;
  }
  state.current = state.profiles[state.activeProfile].current;
  state.planned = state.profiles[state.activeProfile].planned;
  notify();
  return true;
}

export function renameProfile(idx, name) {
  if (idx < 0 || idx >= state.profiles.length) return;
  const clean = (name && String(name).trim()) || state.profiles[idx].name;
  state.profiles[idx].name = clean;
  notify();
}
