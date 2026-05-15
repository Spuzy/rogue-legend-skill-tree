// Pure cost math. All level indices are 0-based; "level N" displayed to the
// user corresponds to index N-1 in costByLevel / minutesByLevel.
//
// Ad-skip model (per user spec): each level can be ad-skipped 4 times, each
// time reducing by max(10% of base, 5 min). Combined reduction per level:
//     reduction = max(20 minutes, time * 0.40)   (clamped to time)
// → paidMinutes(t) = max(0, t - max(20, t * 0.4))
//   t <= 20 → 0 (free), 20 < t <= 50 → t-20, t > 50 → t*0.6
//
// Gems per level = ceil(paidMinutes) * gemsPerMin.

import { TREES } from './data.js';

export function paidMinutes(t) {
  if (t <= 0) return 0;
  const reduction = Math.max(20, t * 0.4);
  return Math.max(0, t - reduction);
}

export function levelGems(treeId, minutes) {
  const gpm = TREES[treeId].gemsPerMin;
  return Math.ceil(paidMinutes(minutes)) * gpm;
}

/** Cumulative cost to go from owned level `from` to target level `to` (both
 * displayed levels in [0..maxLevel]). Sums level indices from..to-1. */
export function rangeCost(node, from, to) {
  const result = { books: 0, minutes: 0, paidMinutes: 0, gems: 0 };
  if (!node || to <= from) return result;
  const start = Math.max(0, from);
  const end = Math.min(node.maxLevel, to);
  for (let i = start; i < end; i++) {
    const t = node.minutesByLevel[i];
    const c = node.costByLevel[i];
    result.books   += c;
    result.minutes += t;
    const pm = paidMinutes(t);
    result.paidMinutes += pm;
  }
  result.gems = Math.ceil(result.paidMinutes) * TREES[node.treeId].gemsPerMin;
  return result;
}

/** Highest target level reachable from `from` such that cumulative books <=
 * bookBudget and cumulative gems <= gemBudget. Returns the level (>= from). */
export function maxAffordableLevel(node, from, bookBudget, gemBudget) {
  let books = 0;
  let paidMin = 0;
  const gpm = TREES[node.treeId].gemsPerMin;
  let lvl = from;
  for (let i = from; i < node.maxLevel; i++) {
    const c = node.costByLevel[i];
    const t = node.minutesByLevel[i];
    const newBooks = books + c;
    const newPaidMin = paidMin + paidMinutes(t);
    const newGems = Math.ceil(newPaidMin) * gpm;
    if (newBooks > bookBudget || newGems > gemBudget) break;
    books = newBooks;
    paidMin = newPaidMin;
    lvl = i + 1;
  }
  return lvl;
}

/** Non-accumulative check: does this individual level fit the budget on its
 * own (ignoring the cost of previous levels)? `lvlIndex` is 0-based. */
export function levelFitsBudget(node, lvlIndex, bookBudget, gemBudget) {
  if (lvlIndex < 0 || lvlIndex >= node.maxLevel) return false;
  const c = node.costByLevel[lvlIndex];
  const t = node.minutesByLevel[lvlIndex];
  const gems = Math.ceil(paidMinutes(t)) * TREES[node.treeId].gemsPerMin;
  return c <= bookBudget && gems <= gemBudget;
}

/** True if at least one future level (> from) is reachable under the budget,
 * honoring accumulative vs. per-level mode. */
export function anyFutureLevelFits(node, from, bookBudget, gemBudget, accumulative) {
  if (from >= node.maxLevel) return false;
  if (accumulative) return maxAffordableLevel(node, from, bookBudget, gemBudget) > from;
  for (let i = from; i < node.maxLevel; i++) {
    if (levelFitsBudget(node, i, bookBudget, gemBudget)) return true;
  }
  return false;
}

export function formatMinutes(min) {
  if (!min) return '0m';
  min = Math.round(min);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const out = [];
  if (d) out.push(d + 'd');
  if (h) out.push(h + 'h');
  if (m || !out.length) out.push(m + 'm');
  return out.join(' ');
}

export function formatNumber(n) {
  return Math.round(n).toLocaleString('en-US');
}
