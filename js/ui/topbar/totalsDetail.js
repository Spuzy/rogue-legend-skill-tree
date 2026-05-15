// Detailed grouped breakdown shown beneath the Totals card when the user
// clicks the ▾ button. Renders pets / sentinels / mounts / pvp groupings
// using `computeGroupedTotals()` from core/stats.js.

import { computeGroupedTotals } from '../../core/stats.js';

function formatPct(v) {
  if (!v) return '+0%';
  const n = Number(v);
  if (Number.isInteger(n)) return `+${n}%`;
  return `+${n.toFixed(1).replace(/\.0$/, '')}%`;
}

// Per-node-id text color. Keys are localDataIds (matching what
// `aggregateByLocalId()` produces). Values are CSS custom-property
// expressions defined in css/tokens.css.
const ID_COLOR = {
  // Rarity buckets
  spec_epic_pet_dmg:       'var(--rarity-epic)',
  spec_legendary_pet_dmg:  'var(--rarity-legendary)',
  spec_mythic_pet_dmg:     'var(--rarity-mythic)',

  // Pets
  spec_shroomurk_pet_dmg:  'var(--c-purple)',
  spec_pyrehorn_pet_dmg:   'var(--c-red)',
  spec_noctibun_pet_dmg:   'var(--c-grey)',
  spec_castlepod_pet_dmg:  'var(--c-grey)',
  spec_voltrix_pet_dmg:    'var(--c-yellow)',
  spec_frostpaw_pet_dmg:   'var(--c-ice)',
  spec_blazewing_pet_dmg:  'var(--c-red)',
  spec_boneclaw_pet_dmg:   'var(--c-grey)',
  spec_flux_pet_dmg:       'var(--c-yellow)',
  spec_glacidrake_pet_dmg: 'var(--c-ice)',
  spec_neklaw_pet_dmg:     'var(--c-darkred)',
  spec_spore_pet_dmg:      'var(--c-purple)',

  // Sentinels (internal id → display name color)
  spec_stone_sentinel_dmg:     'var(--c-grey)',
  spec_blades_sentinel_dmg:    'var(--c-darkred)',
  spec_fire_sentinel_dmg:      'var(--c-red)',
  spec_ice_sentinel_dmg:       'var(--c-ice)',
  spec_lightning_sentinel_dmg: 'var(--c-yellow)',

  // Mounts (both _dmg and _hp share rarity-style colors)
  spec_dino_dmg:        'var(--c-ice)',
  spec_dino_hp:         'var(--c-ice)',
  spec_bramblemaw_dmg:  'var(--c-purple)',
  spec_bramblemaw_hp:   'var(--c-purple)',
  spec_ultimania_dmg:   'var(--rarity-legendary)',
  spec_ultimania_hp:    'var(--rarity-legendary)',
  spec_aurora_dmg:      'var(--rarity-legendary)',
  spec_aurora_hp:       'var(--rarity-legendary)',

  // PvP
  spec_pvp_atk: 'var(--atk)',
  spec_pvp_def: 'var(--def)',
  spec_pvp_hp:  'var(--hp)',
};

const colorFor = (id) => ID_COLOR[id] || '';

function chip(item) {
  if (!item) return '';
  const color = colorFor(item.id);
  const style = color ? ` style="color:${color}"` : '';
  return `<span class="td-chip">
      <span class="td-chip-name"${style}>${item.name}</span>
      <span class="td-chip-val">${formatPct(item.val)}</span>
    </span>`;
}

function chipsHTML(items) {
  if (!items || !items.length) return '<div class="td-empty">&mdash;</div>';
  return `<div class="td-chips">${items.map(chip).join('')}</div>`;
}

function singleHTML(item, fallbackLabel) {
  if (!item) {
    return `<div class="td-chip td-chip-solo"><span class="td-chip-name">${fallbackLabel}</span><span class="td-chip-val">+0%</span></div>`;
  }
  const color = colorFor(item.id);
  const style = color ? ` style="color:${color}"` : '';
  return `<div class="td-chip td-chip-solo"><span class="td-chip-name"${style}>${item.name}</span><span class="td-chip-val">${formatPct(item.val)}</span></div>`;
}

export function renderTotalsDetail(host) {
  if (!host) return;
  const g = computeGroupedTotals();
  const globalChips = [g.global.reduceCrit, g.global.reduceMounted].filter(Boolean);
  host.innerHTML = `
    <div class="td-group">
      <div class="td-group-title">Global</div>
      ${globalChips.length ? chipsHTML(globalChips) : '<div class="td-empty">&mdash;</div>'}
    </div>
    <div class="td-group">
      <div class="td-group-title">Pets</div>
      ${singleHTML(g.pets.all, 'All pets')}
      ${g.pets.rarity.length ? `<div class="td-sub">By rarity</div>${chipsHTML(g.pets.rarity)}` : ''}
      ${g.pets.perPet.length ? `<div class="td-sub">Per pet</div>${chipsHTML(g.pets.perPet)}` : ''}
    </div>
    <div class="td-group">
      <div class="td-group-title">Sentinels</div>
      ${singleHTML(g.sentinels.all, 'All sentinels')}
      ${g.sentinels.perSentinel.length ? `<div class="td-sub">Per sentinel</div>${chipsHTML(g.sentinels.perSentinel)}` : ''}
    </div>
    <div class="td-group">
      <div class="td-group-title">Mounts</div>
      ${singleHTML(g.mounts.hp, 'Mount HP')}
      ${g.mounts.perMount.length ? `<div class="td-sub">Per mount</div>${chipsHTML(g.mounts.perMount)}` : ''}
    </div>
    <div class="td-group">
      <div class="td-group-title">PvP</div>
      ${g.pvp.core.length ? `<div class="td-sub">Core</div>${chipsHTML(g.pvp.core)}` : ''}
      ${g.pvp.vs.length   ? `<div class="td-sub">DMG reduction</div>${chipsHTML(g.pvp.vs)}` : ''}
      ${(!g.pvp.core.length && !g.pvp.vs.length) ? '<div class="td-empty">&mdash;</div>' : ''}
    </div>
  `;
}
