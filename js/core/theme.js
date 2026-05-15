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

const THEME_RULES = [
  // ── Universal small buffs (rendered as squares) ─────────────────────
  { test: 'small_atk_buff', theme: 'atk' },
  { test: 'small_def_buff', theme: 'def' },
  { test: 'small_hp_buff',  theme: 'hp'  },

  // ── Spec branch 0: PvP ──────────────────────────────────────────────
  // Tier roots: spec_pvp_dmg_reduction → spec_dmg_reduction_heroes
  //             → spec_dmg_reduction_sentinels → spec_dmg_reduction_pets
  { test: /pvp/,                          theme: 'pvp' },
  { test: 'spec_dmg_reduction_heroes',    theme: 'pvp' },
  { test: 'spec_dmg_reduction_sentinels', theme: 'sentinel' },
  { test: 'spec_dmg_reduction_pets',      theme: 'pet' },

  // ── Spec branch 1: Mounts ───────────────────────────────────────────
  { test: 'spec_dmg_reduction_mounted', theme: 'mount' },
  { test: 'spec_reduce_enemy_crit_dmg', theme: 'mount' },
  { test: /mount|mounted|dino|bramblemaw|aurora|ultimania/, theme: 'mount' },

  // ── Spec branch 2: Pets ─────────────────────────────────────────────
  { test: id => id === 'spec_pet_dmg' || id.endsWith('_pet_dmg') || id.includes('pets_enhancement'),
    theme: 'pet' },

  // ── Spec branch 3: Sentinels ────────────────────────────────────────
  { test: /sentinel/, theme: 'sentinel' },

  // ── Adventure tree: generic effect enhancements ─────────────────────
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
