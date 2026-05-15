// Layout for Adventure + Specialization trees.
//
// ADVENTURE: hand-tuned 45° diamond lattice. Every node is placed on an
// integer (lx, ly) grid where ly increases as we go UP the tree. Edges
// between adjacent nodes are either at 45° (diagonal step of 1,1) or
// vertical (a "small buff" sitting in the middle column between four
// surrounding nodes — user-requested exception).
//
// SPECIALIZATION: compass layout. The 4 branch roots sit close to the
// origin and each branch extends outward in a cardinal direction:
//   branch 0 (PvP)      → UP
//   branch 1 (Mounts)   → RIGHT
//   branch 2 (Pets)     → DOWN
//   branch 3 (Sentinel) → LEFT

import { TREES } from '../core/data.js';
import { LAYOUT_OVERRIDES } from './overrides.js';

const ADV_STEP = 85;    // lattice step in both axes
const ADV_MAX_LY = 15;  // tier 0 (root) at ly=0 sits at the BOTTOM

// Lattice coordinates (lx, ly) for every Adventure node.
// ly grows upward = farther from root. Diagonal edges (|Δlx|=|Δly|=1) are
// the "normal" 45° connection; vertical edges (Δlx=0, Δly=1) are the
// in-column small-buff exception.
const ADV_LATTICE = {
  '0_0':  [ 0,  0],
  // Tier 1 — small buffs
  '1_0':  [-1, 1], '1_1':  [ 0, 1], '1_2':  [ 1, 1],
  // Tier 2 — small buffs (locked)
  '2_0':  [-1, 2], '2_1':  [ 0, 2], '2_2':  [ 1, 2],
  // Tier 3 — warrior / general / wizard
  '3_0':  [-2, 3], '3_1':  [ 0, 3], '3_2':  [ 2, 3],
  // Tier 4 — six small buffs
  '4_0':  [-3, 4], '4_1':  [-2, 4], '4_2':  [-1, 4],
  '4_3':  [ 1, 4], '4_4':  [ 2, 4], '4_5':  [ 3, 4],
  // Tier 5 — five skills
  '5_0':  [-4, 5], '5_1':  [-2, 5], '5_2':  [ 0, 5], '5_3':  [ 2, 5], '5_4':  [ 4, 5],
  // Tier 6 — six small buffs
  '6_0':  [-3, 6], '6_1':  [-2, 6], '6_2':  [-1, 6],
  '6_3':  [ 1, 6], '6_4':  [ 2, 6], '6_5':  [ 3, 6],
  // Tier 7 — five skills
  '7_0':  [-4, 7], '7_1':  [-2, 7], '7_2':  [ 0, 7], '7_3':  [ 2, 7], '7_4':  [ 4, 7],
  // Tier 8 — outer skills + three small buffs.
  // Poison/Ice (8_0, 8_4) sit OUTSIDE the main mesh as floating side branches
  // (matches the in-game layout where they don't visually fan back in).
  '8_0':  [-5, 8], '8_1':  [-1, 8], '8_2':  [ 0, 8], '8_3':  [ 1, 8], '8_4':  [ 5, 8],
  // Tier 9 — three small buffs
  '9_0':  [-1, 9], '9_1':  [ 0, 9], '9_2':  [ 1, 9],
  // Tier 10 — three skills (warrior / general / wizard mirrors).
  // (Ice/Poison rank-2 stay on the spine; only Ice/Poison rank-1 are pushed
  // outside as floating side branches.)
  '10_0': [-2, 10], '10_1': [ 0, 10], '10_2': [ 2, 10],
  // Tier 11 — outer skills + three inner small buffs
  '11_0': [-3, 11], '11_1': [-1, 11], '11_2': [ 0, 11], '11_3': [ 1, 11], '11_4': [ 3, 11],
  // Tier 12 — three small buffs
  '12_0': [-1, 12], '12_1': [ 0, 12], '12_2': [ 1, 12],
  // Tier 13 — three skills
  '13_0': [-2, 13], '13_1': [ 0, 13], '13_2': [ 2, 13],
  // Tier 14 — outer skills + three inner small buffs
  '14_0': [-3, 14], '14_1': [-1, 14], '14_2': [ 0, 14], '14_3': [ 1, 14], '14_4': [ 3, 14],
  // Tier 15 — final skill
  '15_0': [ 0, 15],
};

// Specialization compass directions.
const SPEC_BRANCH = {
  0: { dir: [0, -1], perp: [ 1,  0] }, // PvP — UP
  1: { dir: [1,  0], perp: [ 0,  1] }, // Mounts — RIGHT
  2: { dir: [0,  1], perp: [ 1,  0] }, // Pets — DOWN (perp flipped: shroomurk left, noctibun right)
  3: { dir: [-1, 0], perp: [ 0,  1] }, // Sentinel — LEFT (perp flipped: atk up, def down; fire above, thunder below)
};
const SPEC_CENTER_OFFSET = 130;
const SPEC_TIER_STEP     = 130;
const SPEC_COL_STEP      = 105;

function specPosition(branch, tier, col, n) {
  const { dir, perp } = SPEC_BRANCH[branch];
  const r = SPEC_CENTER_OFFSET + tier * SPEC_TIER_STEP;
  const offset = (col - (n - 1) / 2) * SPEC_COL_STEP;
  return {
    x: dir[0] * r + perp[0] * offset,
    y: dir[1] * r + perp[1] * offset,
  };
}

export function buildLayout(treeId) {
  const tree = TREES[treeId];
  const overrides = LAYOUT_OVERRIDES[treeId] || {};
  const positions = {};

  if (treeId === 'adventure') {
    for (const node of tree.nodes.values()) {
      const lattice = ADV_LATTICE[node.nodeId];
      if (!lattice) continue; // unknown node — skip
      const [lx, ly] = lattice;
      positions[node.nodeId] = {
        x: lx * ADV_STEP,
        y: (ADV_MAX_LY - ly) * ADV_STEP, // ly=0 (root) sits at the bottom
      };
    }
  } else {
    const counts = new Map();
    for (const node of tree.nodes.values()) {
      const [b, t] = node.nodeId.split('_').map(Number);
      const key = b * 100 + t;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const node of tree.nodes.values()) {
      const [b, t, c] = node.nodeId.split('_').map(Number);
      positions[node.nodeId] = specPosition(b, t, c, counts.get(b * 100 + t));
    }
  }

  for (const [id, p] of Object.entries(overrides)) {
    if (positions[id]) positions[id] = { ...p };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of Object.values(positions)) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { positions, bounds: { minX, minY, maxX, maxY } };
}
