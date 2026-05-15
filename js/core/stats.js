// Cross-tree aggregates: total ATK/DEF/HP % buffs and per-tree currency spent.
// Each buff node grants 1% per owned level. Both trees use a "books" currency
// but the art differs (adventure_currency vs specialization_currency), so we
// keep the totals separate.

import { TREES } from './data.js';
import { state } from './state.js';

export function computeTotals() {
  let atk = 0, def = 0, hp = 0, advSpent = 0, specSpent = 0;
  for (const tree of Object.values(TREES)) {
    for (const node of tree.nodes.values()) {
      const cur = state.current[node.nodeId] || 0;
      if (cur <= 0) continue;
      if (node.theme === 'atk') atk += cur;
      else if (node.theme === 'def') def += cur;
      else if (node.theme === 'hp')  hp  += cur;
      let cost = 0;
      for (let i = 0; i < cur; i++) cost += node.costByLevel[i] || 0;
      if (tree.id === 'adventure') advSpent += cost;
      else if (tree.id === 'specialization') specSpent += cost;
    }
  }
  return { atk, def, hp, advSpent, specSpent };
}

// ---- Grouped/specialization breakdown ----
//
// Aggregates the live percentage effect of every owned node, keyed by the
// node's `localDataId` so multiple lattice instances of the same buff stack
// into a single bucket. The effect at a given level is read from
// `node.levelValues[cur-1]` (populated by the metadata enrichment). If the
// node has no level_values, we fall back to `cur` (1% per level).

function nodeEffect(node, cur) {
  if (cur <= 0) return 0;
  const arr = node.levelValues;
  if (arr && arr.length >= cur) return Number(arr[cur - 1]) || 0;
  return cur;
}

function aggregateByLocalId() {
  const sum = Object.create(null);
  for (const tree of Object.values(TREES)) {
    for (const node of tree.nodes.values()) {
      const cur = state.current[node.nodeId] || 0;
      if (cur <= 0) continue;
      const v = nodeEffect(node, cur);
      const id = node.localDataId;
      if (!sum[id]) sum[id] = { id, name: node.displayName, val: 0, iconPath: node.iconPath };
      sum[id].val += v;
    }
  }
  return sum;
}

const PET_RARITY_IDS = ['spec_epic_pet_dmg', 'spec_legendary_pet_dmg', 'spec_mythic_pet_dmg'];

export function computeGroupedTotals() {
  const sum = aggregateByLocalId();
  const pick = ids => ids.map(id => sum[id]).filter(Boolean);
  const filterIds = pred => Object.keys(sum).filter(pred).map(id => sum[id]);

  return {
    global: {
      reduceCrit:    sum['spec_reduce_enemy_crit_dmg'] || null,
      reduceMounted: sum['spec_dmg_reduction_mounted'] || null,
    },
    pets: {
      all:    sum['spec_pet_dmg'] || null,
      rarity: pick(PET_RARITY_IDS),
      perPet: filterIds(id =>
        /_pet_dmg$/.test(id) &&
        id !== 'spec_pet_dmg' &&
        !PET_RARITY_IDS.includes(id),
      ),
    },
    sentinels: {
      all: sum['spec_sentinel_dmg'] || null,
      perSentinel: filterIds(id =>
        /_sentinel_dmg$/.test(id) && id !== 'spec_sentinel_dmg',
      ),
    },
    mounts: {
      hp: sum['spec_mount_hp'] || null,
      perMount: filterIds(id =>
        /^spec_(aurora|bramblemaw|dino|ultimania)_(dmg|hp)$/.test(id),
      ),
    },
    pvp: {
      core: pick(['spec_pvp_atk', 'spec_pvp_def', 'spec_pvp_hp']),
      vs:   pick([
        'spec_pvp_dmg_reduction',
        'spec_dmg_reduction_heroes',
        'spec_dmg_reduction_pets',
        'spec_dmg_reduction_sentinels',
      ]),
    },
  };
}

