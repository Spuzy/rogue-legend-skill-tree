// Centralised mapping from a node's `localDataId` to a UI theme name.
//
// SINGLE SOURCE OF TRUTH for node theming. Add one row here when a new
// node id appears in the data dump. First matching rule wins.
//
// Theme names are consumed by:
//   - css/canvas.css       → `.node.theme-<name> .shape { fill: ... }`
//   - js/render/index.js   → `isShapeSquare(theme)` (atk/def/hp render as squares)
//
// `test` may be:
//   - a string  → exact match on localDataId
//   - a RegExp  → `.test()` against localDataId
//   - a fn      → `(id) => boolean`
//
// Priority order (top to bottom):
//   1. Universal small atk/def/hp buffs (square shape).
//   2. Spec-tree TIER ROOTS (the big hexagons that anchor a branch) —
//      ONLY these get bucket colours (pvp/mount/pet/sentinel).
//   3. Suffix fallbacks: anything ending in `_atk`/`_def`/`_hp`/`_dmg`
//      inherits the matching universal colour, so per-pet / per-mount
//      sub-nodes look like attack/defence/hp instead of the bucket.
//   4. Adventure-tree effect themes.
//   5. Bucket regex fallbacks (catch-all).

const THEME_RULES = [
  // ── 1. Universal small buffs (rendered as squares) ──────────────────
  { test: 'small_atk_buff', theme: 'atk' },
  { test: 'small_def_buff', theme: 'def' },
  { test: 'small_hp_buff',  theme: 'hp'  },

  // ── 2. Spec tier roots (the only nodes that get bucket colours) ─────
  // PvP branch
  { test: 'spec_pvp_dmg_reduction',       theme: 'pvp' },
  { test: 'spec_dmg_reduction_heroes',    theme: 'pvp' },
  { test: 'spec_dmg_reduction_sentinels', theme: 'sentinel' },
  { test: 'spec_dmg_reduction_pets',      theme: 'pet' },
  // Mount branch (only the GLOBAL mount nodes are blue)
  { test: 'spec_dmg_reduction_mounted', theme: 'mount' },
  { test: 'spec_reduce_enemy_crit_dmg', theme: 'mount' },
  { test: 'spec_mount_hp',              theme: 'mount' },
  // Pet branch (rarity-tier roots)
  { test: 'spec_pet_dmg',           theme: 'pet' },
  { test: 'spec_epic_pet_dmg',      theme: 'pet' },
  { test: 'spec_legendary_pet_dmg', theme: 'pet' },
  { test: 'spec_mythic_pet_dmg',    theme: 'pet' },
  // Sentinel branch (tier roots)
  { test: 'spec_sentinel_dmg',           theme: 'sentinel' },
  { test: 'spec_epic_sentinel_dmg',      theme: 'sentinel' },
  { test: 'spec_legendary_sentinel_dmg', theme: 'sentinel' },
  { test: 'spec_mythic_sentinel_dmg',    theme: 'sentinel' },
  { test: 'spec_lightning_sentinel_dmg', theme: 'sentinel' },

  // ── 3. Suffix fallbacks: per-pet / per-mount / per-pvp sub-nodes ────
  { test: /_atk$/, theme: 'atk' },
  { test: /_def$/, theme: 'def' },
  { test: /_hp$/,  theme: 'hp'  },
  { test: /_dmg$/, theme: 'atk' },

  // ── 4. Adventure-tree effect themes ─────────────────────────────────
  { test: /general_enhancement/, theme: 'general' },
  { test: /warrior/,   theme: 'warrior'   },
  { test: /wizard/,    theme: 'wizard'    },
  { test: /fire/,      theme: 'fire'      },
  { test: /ice/,       theme: 'ice'       },
  { test: /lightning/, theme: 'lightning' },
  { test: /poison/,    theme: 'poison'    },
  { test: /crit/,      theme: 'crit'      },
  { test: /heals/,     theme: 'heals'     },
  { test: /shields/,   theme: 'shields'   },
  { test: /dmg_reduction|dmgreduct/, theme: 'dmgreduct' },
  { test: /enraged/,   theme: 'enraged'   },
  { test: /combo/,     theme: 'combo'     },
  { test: /counter/,   theme: 'counter'   },
  { test: /shuriken/,  theme: 'shuriken'  },
  { test: /status/,    theme: 'status'    },
  { test: /wound/,     theme: 'wound'     },

  // ── 5. Bucket fallbacks (rare; only if nothing matched above) ───────
  { test: /pvp/,      theme: 'pvp'      },
  { test: /sentinel/, theme: 'sentinel' },
  { test: /pet/,      theme: 'pet'      },
  { test: /mount|dino|bramblemaw|aurora|ultimania/, theme: 'mount' },
];

const FALLBACK = 'spec';

export function themeForLocalId(localId) {
  if (!localId) return FALLBACK;
  for (const rule of THEME_RULES) {
    const t = rule.test;
    if (typeof t === 'string') {
      if (localId === t) return rule.theme;
    } else if (t instanceof RegExp) {
      if (t.test(localId)) return rule.theme;
    } else if (typeof t === 'function') {
      if (t(localId)) return rule.theme;
    }
  }
  return FALLBACK;
}
