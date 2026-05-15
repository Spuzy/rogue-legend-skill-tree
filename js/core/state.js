// Player state: current owned level + planned target per node. Persisted to
// localStorage.

const KEY = 'rogue_legend_skill_sim_v1';

const initial = () => ({
  activeTree: 'adventure',
  current: {},   // nodeId -> level
  planned: {},   // nodeId -> level
  filter: { active: false, accumulative: true, books: 0, gems: 0 },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw);
    return { ...initial(), ...parsed, filter: { ...initial().filter, ...(parsed.filter || {}) } };
  } catch { return initial(); }
}

export const state = load();

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() {
  save();
  listeners.forEach(fn => fn());
}

function save() {
  try {
    // `search` is intentionally ephemeral — strip it before persisting so a
    // stale query doesn't survive a page reload.
    const { search, ...persisted } = state;
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
  state.current = current;
  state.planned = planned;
  notify();
}

export function resetAll() {
  // Wipe progress only. Filter state (toggle + values) is preserved so the
  // checkmark stays the source of truth — no off/on dance needed afterwards.
  state.current = {};
  state.planned = {};
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
