// SVG rendering: edges + nodes for the active tree, with pan/zoom.

import { TREES } from '../core/data.js';
import { state, getCurrent, getPlanned } from '../core/state.js';
import { buildLayout } from '../layout/layout.js';
import { maxAffordableLevel, anyFutureLevelFits } from '../core/cost.js';
import { openPopup } from '../ui/popup/index.js';
import { getNodeSearchText } from '../core/skill_meta.js';
import { isLocked } from '../core/graph.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const NODE_R = 30;            // radius / half-size of a skill (hex) node
const BUFF_SCALE = 0.6;       // small buff nodes render at 60% size (40% smaller)
// Spec sub-buff nodes (no specialization overlay) use the Small_*_Buff base
// sprite — they render as small squares like the adventure buffs.
const SMALL_BUFF_SPRITES = new Set(['Small_ATK_Buff', 'Small_HP_Buff', 'Small_DEF_Buff']);
function isSquareNode(node) {
  if (isShapeSquare(node.theme)) return true;
  if (SMALL_BUFF_SPRITES.has(node.iconSprite || '') && !node.overlayIconPath) return true;
  return false;
}
function nodeRadius(node) { return isSquareNode(node) ? NODE_R * BUFF_SCALE : NODE_R; }

let svg, viewport, edgesG, nodesG;
let view = { x: 0, y: 0, scale: 0.9 };
const layoutCache = {};       // treeId -> { positions, bounds }
const nodeEls = new Map();    // nodeId -> <g>

export function initRender(svgEl) {
  svg = svgEl;
  // Stable structure: one viewport <g> we pan/zoom, with two child groups.
  svg.innerHTML = '';
  viewport = document.createElementNS(SVG_NS, 'g');
  viewport.setAttribute('class', 'viewport');
  edgesG = document.createElementNS(SVG_NS, 'g');
  edgesG.setAttribute('class', 'edges');
  nodesG = document.createElementNS(SVG_NS, 'g');
  nodesG.setAttribute('class', 'nodes');
  viewport.append(edgesG, nodesG);
  svg.appendChild(viewport);

  // Pan
  let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;
  svg.addEventListener('mousedown', e => {
    if (e.target.closest('.node')) return;
    dragging = true; startX = e.clientX; startY = e.clientY;
    origX = view.x; origY = view.y;
    svg.classList.add('panning');
    // Pan must NOT close the popup — keep the currently inspected node visible.
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    view.x = origX + (e.clientX - startX);
    view.y = origY + (e.clientY - startY);
    applyTransform();
  });
  window.addEventListener('mouseup', () => { dragging = false; svg.classList.remove('panning'); });
  // Zoom
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(0.15, Math.min(2.5, view.scale * factor));
    // Zoom toward cursor
    view.x = mx - (mx - view.x) * (newScale / view.scale);
    view.y = my - (my - view.y) * (newScale / view.scale);
    view.scale = newScale;
    applyTransform();
  }, { passive: false });
}

function applyTransform() {
  viewport.setAttribute('transform', `translate(${view.x}, ${view.y}) scale(${view.scale})`);
}

export function centerTree(treeId) {
  const layout = layoutCache[treeId] || (layoutCache[treeId] = buildLayout(treeId));
  const { bounds } = layout;
  const rect = svg.getBoundingClientRect();
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const margin = 100;
  view.scale = Math.min(1.2, (rect.width - margin) / Math.max(1, w), (rect.height - margin) / Math.max(1, h));
  view.scale = Math.max(0.2, view.scale);
  // Specialization tree is sparse; default-zoom it 2x so node art is legible.
  if (treeId === 'specialization') view.scale = Math.min(2.5, view.scale * 2);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  view.x = rect.width / 2 - cx * view.scale;
  view.y = rect.height / 2 - cy * view.scale;
  applyTransform();
}

function isShapeSquare(theme) {
  return theme === 'atk' || theme === 'def' || theme === 'hp';
}

function nodeStateClasses(tree, node) {
  const cur = getCurrent(node.nodeId);
  const plan = getPlanned(node.nodeId);
  const cls = [`theme-${node.theme}`];
  if (isLocked(tree, node)) cls.push('locked');
  if (cur === 0) cls.push('unowned');
  else if (cur >= node.maxLevel) cls.push('maxed');
  else cls.push('partial');
  if (plan > cur) cls.push('planned');
  // Filter highlight: any reachable level under budget beyond current.
  if (state.filter.active && cur < node.maxLevel) {
    if (anyFutureLevelFits(node, cur, state.filter.books, state.filter.gems, state.filter.accumulative !== false)) {
      cls.push('budget-fit');
    }
  }
  // Search highlight: case-insensitive substring match on display name,
  // description, and any unlocked skill's name / type / description.
  const q = (state.search || '').trim().toLowerCase();
  if (q) {
    const haystack = getNodeSearchText(node.localDataId, node.displayName);
    if (haystack.includes(q)) cls.push('search-match');
  }
  return cls.join(' ');
}

function drawShape(node) {
  const r = nodeRadius(node);
  if (isSquareNode(node)) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', -r); rect.setAttribute('y', -r);
    rect.setAttribute('width', r * 2); rect.setAttribute('height', r * 2);
    rect.setAttribute('rx', 6);
    rect.setAttribute('class', 'shape');
    return rect;
  }
  // Hex pointed-top
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', pts.join(' '));
  poly.setAttribute('class', 'shape');
  return poly;
}

export function render() {
  const treeId = state.activeTree;
  const tree = TREES[treeId];
  const layout = layoutCache[treeId] || (layoutCache[treeId] = buildLayout(treeId));
  const pos = layout.positions;

  // Edges
  edgesG.innerHTML = '';
  for (const node of tree.nodes.values()) {
    const p = pos[node.nodeId];
    for (const cid of node.childIds) {
      const child = tree.nodes.get(cid);
      if (!child) continue;
      const cp = pos[cid];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', p.x); line.setAttribute('y1', p.y);
      line.setAttribute('x2', cp.x); line.setAttribute('y2', cp.y);
      const lockedEdge = isLocked(tree, node) || isLocked(tree, child);
      line.setAttribute('class', `edge${lockedEdge ? ' locked' : ''}`);
      edgesG.appendChild(line);
    }
  }

  // Nodes
  nodesG.innerHTML = '';
  nodeEls.clear();
  for (const node of tree.nodes.values()) {
    const p = pos[node.nodeId];
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `node ${nodeStateClasses(tree, node)}`);
    g.setAttribute('transform', `translate(${p.x}, ${p.y})`);
    g.dataset.nodeId = node.nodeId;

    // Glow halo (rendered first, behind everything)
    const r = nodeRadius(node);
    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('class', 'halo');
    halo.setAttribute('r', r + 8);
    g.appendChild(halo);

    g.appendChild(drawShape(node));

    // Icon
    const img = document.createElementNS(SVG_NS, 'image');
    img.setAttributeNS(XLINK, 'href', node.iconPath);
    img.setAttribute('href', node.iconPath);
    const iconSize = r * 1.4;
    img.setAttribute('x', -iconSize / 2); img.setAttribute('y', -iconSize / 2);
    img.setAttribute('width', iconSize); img.setAttribute('height', iconSize);
    img.setAttribute('class', 'node-icon');
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    g.appendChild(img);

    // Specialization overlay icon (small pet/element portrait, top-left).
    if (node.overlayIconPath) {
      const ov = document.createElementNS(SVG_NS, 'image');
      ov.setAttributeNS(XLINK, 'href', node.overlayIconPath);
      ov.setAttribute('href', node.overlayIconPath);
      const ovSize = r * 0.95;
      ov.setAttribute('x', -r * 0.95);
      ov.setAttribute('y', -r * 0.95);
      ov.setAttribute('width', ovSize);
      ov.setAttribute('height', ovSize);
      ov.setAttribute('class', 'node-overlay');
      ov.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      g.appendChild(ov);
    }

    // Level badge (current / max)
    const cur = getCurrent(node.nodeId);
    const badge = document.createElementNS(SVG_NS, 'g');
    badge.setAttribute('class', 'badge');
    badge.setAttribute('transform', `translate(0, ${r + 4})`);
    const badgeBg = document.createElementNS(SVG_NS, 'rect');
    badgeBg.setAttribute('x', -22); badgeBg.setAttribute('y', 0);
    badgeBg.setAttribute('width', 44); badgeBg.setAttribute('height', 18);
    badgeBg.setAttribute('rx', 9);
    badgeBg.setAttribute('class', 'badge-bg');
    badge.appendChild(badgeBg);
    const badgeText = document.createElementNS(SVG_NS, 'text');
    badgeText.setAttribute('x', 0); badgeText.setAttribute('y', 13);
    badgeText.setAttribute('text-anchor', 'middle');
    badgeText.setAttribute('class', 'badge-text');
    badgeText.textContent = `${cur}/${node.maxLevel}`;
    badge.appendChild(badgeText);
    g.appendChild(badge);

    // (Locked nodes are signalled by the greyed-out shape only — no 🔒 overlay.)

    g.addEventListener('click', e => {
      e.stopPropagation();
      openPopup(node, g);
    });

    nodesG.appendChild(g);
    nodeEls.set(node.nodeId, g);
  }
}
