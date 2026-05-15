// Graph queries that are pure functions of (tree, node) + player state. Lives
// in core/ so both render and ui code can import it without pulling in the
// SVG layer (this used to live in render.js, which created an awkward
// popup → render circular import).

import { getCurrent, getPlanned, setCurrent, setPlanned } from './state.js';
import { TREES } from './data.js';

/** A node is locked when at least one parent is at level 0. Roots are never
 * locked. */
export function isLocked(tree, node) {
  if (!node.parentIds.length) return false;
  return !node.parentIds.every(pid => getCurrent(pid) >= 1);
}

/** When a node's level drops to 0, any descendant that becomes locked must
 * also be reset (current + planned cleared), recursively. */
export function cascadeRelock(node) {
  const tree = TREES[node.treeId];
  for (const cid of node.childIds) {
    const child = tree.nodes.get(cid);
    if (!child) continue;
    const nowLocked = !child.parentIds.every(pid => getCurrent(pid) >= 1);
    if (nowLocked && (getCurrent(child.nodeId) > 0 || getPlanned(child.nodeId) > 0)) {
      setCurrent(child, 0);
      setPlanned(child, 0);
      cascadeRelock(child);
    }
  }
}

/** Walk parent edges and collect every ancestor that fails `needs(id)`. The
 * returned list is the minimal set of prerequisites that must be raised to
 * satisfy the requirement on `node`. If a parent already passes `needs`, we
 * stop on that branch (its own ancestors are already fine). */
export function collectPrereqChain(node, needs) {
  const tree = TREES[node.treeId];
  const result = new Set();
  const visit = (n) => {
    for (const pid of n.parentIds) {
      if (result.has(pid)) continue;
      const parent = tree.nodes.get(pid);
      if (!parent) continue;
      if (needs(pid)) {
        result.add(pid);
        visit(parent);
      }
    }
  };
  visit(node);
  return [...result].map(id => tree.nodes.get(id));
}
