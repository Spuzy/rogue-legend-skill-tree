// Compact share-code encoder/decoder.
//
// Format (v1):  "1" + base64url( sparse entries )
//   Each entry = nodeId + ":" + hex(current) + hex(plan)
//   Entries separated by ","
//   Only nodes where current > 0 OR plan > 0 are included.
//
// Levels 0-10 fit in a single hex digit (0-a).
// A typical 30%-filled tree produces a ~60-80 char string.

import { TREES } from './data.js';
import { getCurrent, getPlanned, loadSharedState } from './state.js';

function toBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

export function encode() {
  const entries = [];
  for (const tree of Object.values(TREES)) {
    for (const node of tree.nodes.values()) {
      const cur  = getCurrent(node.nodeId);
      const plan = getPlanned(node.nodeId);
      if (cur === 0 && plan === 0) continue;
      entries.push(node.nodeId + ':' + cur.toString(16) + plan.toString(16));
    }
  }
  if (entries.length === 0) return '1';
  return '1' + toBase64Url(entries.join(','));
}

export function decode(code) {
  if (!code || code.length < 1) return null;
  const version = code[0];
  if (version !== '1') return null;
  if (code.length === 1) return { current: {}, planned: {} };

  const raw = fromBase64Url(code.slice(1));
  const current = {};
  const planned = {};

  const nodeIndex = new Map();
  for (const tree of Object.values(TREES)) {
    for (const node of tree.nodes.values()) {
      nodeIndex.set(node.nodeId, node);
    }
  }

  for (const entry of raw.split(',')) {
    const sep = entry.lastIndexOf(':');
    if (sep < 0) continue;
    const nodeId = entry.slice(0, sep);
    const vals = entry.slice(sep + 1);
    if (vals.length < 2) continue;
    const node = nodeIndex.get(nodeId);
    if (!node) continue;
    const cur  = Math.min(parseInt(vals[0], 16), node.maxLevel);
    const plan = Math.min(parseInt(vals[1], 16), node.maxLevel);
    if (cur > 0) current[nodeId] = cur;
    if (plan > 0) planned[nodeId] = Math.max(plan, cur);
  }

  return { current, planned };
}

export function applyCode(code) {
  const result = decode(code);
  if (!result) return false;
  loadSharedState(result.current, result.planned);
  return true;
}
