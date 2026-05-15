// Parse the embedded CSV into per-tree node graphs.

import { RAW_CSV, DISPLAY_NAMES, TREE_CONFIG } from './data.generated.js';

function parseCSV(text) {
  // Strict-enough CSV: every field is quoted in our source data.
  const rows = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseRow(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const row = {};
    header.forEach((h, j) => { row[h] = cells[j]; });
    rows.push(row);
  }
  return rows;
}

function parseRow(line) {
  // Fields are all surrounded by double quotes, separated by commas.
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '"') { i++; continue; }
    let j = i + 1;
    while (j < line.length && line[j] !== '"') j++;
    out.push(line.slice(i + 1, j));
    i = j + 1;
    if (line[i] === ',') i++;
  }
  return out;
}

function humanize(localDataId) {
  if (DISPLAY_NAMES[localDataId]) return DISPLAY_NAMES[localDataId];
  return localDataId
    .replace(/^(adventure|spec|specialization)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function pipeNums(s) {
  if (!s) return [];
  return s.split('|').map(n => Number(n));
}

function pipeList(s) {
  if (!s) return [];
  return s.split('|').filter(Boolean);
}

function themeFromLocalId(localId) {
  if (localId === 'small_atk_buff') return 'atk';
  if (localId === 'small_def_buff') return 'def';
  if (localId === 'small_hp_buff')  return 'hp';
  if (localId.includes('general_enhancement')) return 'general';
  if (localId.includes('warrior')) return 'warrior';
  if (localId.includes('wizard'))  return 'wizard';
  if (localId.includes('fire'))    return 'fire';
  if (localId.includes('ice'))     return 'ice';
  if (localId.includes('lightning')) return 'lightning';
  if (localId.includes('poison'))  return 'poison';
  if (localId.includes('crit'))    return 'crit';
  if (localId.includes('heals'))   return 'heals';
  if (localId.includes('shields')) return 'shields';
  if (localId.includes('dmgreduct') || localId.includes('dmg_reduction')) return 'dmgreduct';
  if (localId.includes('enraged')) return 'enraged';
  if (localId.includes('combo'))   return 'combo';
  if (localId.includes('counter')) return 'counter';
  if (localId.includes('shuriken'))return 'shuriken';
  if (localId.includes('status'))  return 'status';
  if (localId.includes('wound'))   return 'wound';
  if (localId.includes('pets_enhancement') || localId === 'spec_pet_dmg' || localId.endsWith('_pet_dmg')) return 'pet';
  if (localId.includes('sentinel'))return 'sentinel';
  if (localId.includes('pvp'))     return 'pvp';
  if (localId.includes('mount') || localId.includes('dino'))   return 'mount';
  return 'spec';
}

function buildTree(treeId, rows) {
  const cfg = TREE_CONFIG[treeId];
  const nodes = new Map();
  for (const r of rows) {
    if (r.tree !== treeId) continue;
    const childIds = pipeList(r.childNodeIds);
    nodes.set(r.nodeId, {
      treeId,
      nodeId: r.nodeId,
      localDataId: r.localDataId,
      displayName: humanize(r.localDataId),
      iconPath: `skilltree_0471/icons/${r.localDataId}.png`,
      maxLevel: Number(r.maxLevel),
      costByLevel: pipeNums(r.costByLevel),
      minutesByLevel: pipeNums(r.minutesByLevel),
      totalCost: Number(r.totalCost),
      totalMinutes: Number(r.totalMinutes),
      childIds,
      parentIds: [],
      theme: themeFromLocalId(r.localDataId),
    });
  }
  // Derive parents.
  for (const n of nodes.values()) {
    for (const cid of n.childIds) {
      const child = nodes.get(cid);
      if (child && !child.parentIds.includes(n.nodeId)) child.parentIds.push(n.nodeId);
    }
  }
  return { id: treeId, label: cfg.label, gemsPerMin: cfg.gemsPerMin, currency: cfg.currency, nodes };
}

export const TREES = (() => {
  const rows = parseCSV(RAW_CSV);
  return {
    adventure: buildTree('adventure', rows),
    specialization: buildTree('specialization', rows),
  };
})();

export const ROOT_IDS = {
  adventure: ['0_0'],
  // Each branch (0..3) has its own root in the spec tree.
  specialization: ['0_0_0', '1_0_0', '2_0_0', '3_0_0'],
};

// Overwrite displayName + iconPath from the dumped metadata once it loads.
// Falls back silently for any localDataId we don't have an entry for.
export function enrichTreesWithMeta(getMeta) {
  for (const tree of Object.values(TREES)) {
    for (const node of tree.nodes.values()) {
      const meta = getMeta(node.localDataId);
      if (!meta) continue;
      if (meta.displayName) node.displayName = meta.displayName;
      if (meta.iconPath)    node.iconPath    = meta.iconPath;
      node.iconSprite      = meta.iconSprite || '';
      node.overlayIconPath = meta.overlayIconPath || '';
      node.tailLabels  = meta.tailLabels  || [];
      node.levelValues = meta.levelValues || [];
      node.metaDescription = meta.description || '';
    }
  }
}
