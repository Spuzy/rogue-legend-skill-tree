// Top bar + right sidebar: tree label, reset button, per-tree cost prediction,
// budget filter, and cross-tree totals (ATK/DEF/HP %, total books spent).

import { TREES } from '../../core/data.js';
import { state, getCurrent, getPlanned, setCurrent, setPlanned, setFilter, setActiveTree, resetTree, setSearch } from '../../core/state.js';
import { rangeCost, formatNumber, formatMinutes, maxAffordableLevel } from '../../core/cost.js';
import { computeTotals } from '../../core/stats.js';
import { confirmModal, infoModal, promptModal, copyableModal } from '../modal.js';
import { encode, applyCode } from '../../core/share.js';
import { isLocked } from '../../core/graph.js';
import { renderTotalsDetail } from './totalsDetail.js';

let elements;
let totalsCollapsed = false;
let advancedExpanded = false;

export function initTopbar(opts) {
  elements = opts;

  // Tab clicks
  elements.tabs.querySelectorAll('button[data-tree]').forEach(btn => {
    btn.addEventListener('click', () => setActiveTree(btn.dataset.tree));
  });

  const sync = () => {
    elements.filterBooks.value = state.filter.books || 0;
    elements.filterGems.value  = state.filter.gems || 0;
    elements.filterToggle.checked = !!state.filter.active;
    if (elements.filterAccumulative) elements.filterAccumulative.checked = state.filter.accumulative !== false;
  };
  sync();

  elements.filterBooks.addEventListener('input', () => setFilter({ books: Math.max(0, Number(elements.filterBooks.value) || 0) }));
  elements.filterGems.addEventListener('input',  () => setFilter({ gems:  Math.max(0, Number(elements.filterGems.value)  || 0) }));
  elements.filterToggle.addEventListener('change', () => setFilter({ active: elements.filterToggle.checked }));
  if (elements.filterAccumulative) {
    elements.filterAccumulative.addEventListener('change', () => setFilter({ accumulative: elements.filterAccumulative.checked }));
  }

  if (elements.searchInput) {
    elements.searchInput.value = state.search || '';
    if (elements.searchClear) elements.searchClear.hidden = !elements.searchInput.value;
    elements.searchInput.addEventListener('input', () => {
      setSearch(elements.searchInput.value);
      if (elements.searchClear) elements.searchClear.hidden = !elements.searchInput.value;
    });
    elements.searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        elements.searchInput.value = '';
        setSearch('');
        if (elements.searchClear) elements.searchClear.hidden = true;
      }
    });
  }
  if (elements.searchClear) {
    elements.searchClear.addEventListener('click', () => {
      if (elements.searchInput) elements.searchInput.value = '';
      setSearch('');
      elements.searchClear.hidden = true;
      if (elements.searchInput) elements.searchInput.focus();
    });
  }

  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) helpBtn.addEventListener('click', () => openHelpModal());

  elements.resetBtn.addEventListener('click', async () => {
    const treeId = state.activeTree;
    const treeName = TREES[treeId]?.label || treeId;
    const ok = await confirmModal({
      title: `Reset ${treeName} tree`,
      message: `This clears every current level and plan in the ${treeName} tree. Your budget filter is preserved. This cannot be undone.`,
      confirmText: 'Reset',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (ok) resetTree(treeId);
  });

  if (elements.setPlannedBtn) {
    elements.setPlannedBtn.addEventListener('click', async () => {
      const treeId = state.activeTree;
      const tree = TREES[treeId];
      const promotions = [];
      for (const node of tree.nodes.values()) {
        const cur = getCurrent(node.nodeId);
        const planned = getPlanned(node.nodeId);
        if (planned > cur) promotions.push({ node, from: cur, to: planned });
      }
      if (promotions.length === 0) return;
      const ok = await confirmModal({
        title: `Set planned in ${tree.label}`,
        message: `Promote every planned level to current in the ${tree.label} tree (${promotions.length} node${promotions.length === 1 ? '' : 's'}):`,
        items: promotions.map(p => `${p.node.displayName}  (Lv.${p.from} \u2192 ${p.to})`),
        confirmText: 'Set planned',
        cancelText: 'Cancel',
      });
      if (!ok) return;
      for (const p of promotions) setCurrent(p.node, p.to);
    });
  }

  if (elements.setFilteredBtn) {
    elements.setFilteredBtn.addEventListener('click', async () => {
      const treeId = state.activeTree;
      const tree = TREES[treeId];
      if (!state.filter.active) return;
      const books = state.filter.books || 0;
      const gems  = state.filter.gems  || 0;
      const bumps = [];
      for (const node of tree.nodes.values()) {
        if (isLocked(tree, node)) continue;
        const cur = getCurrent(node.nodeId);
        if (cur >= node.maxLevel) continue;
        const target = maxAffordableLevel(node, cur, books, gems);
        if (target > cur) bumps.push({ node, from: cur, to: target });
      }
      if (bumps.length === 0) return;
      const ok = await confirmModal({
        title: `Set filtered in ${tree.label}`,
        message: `Set every unlocked node to the highest level its budget allows (${bumps.length} node${bumps.length === 1 ? '' : 's'}):`,
        items: bumps.map(b => `${b.node.displayName}  (Lv.${b.from} \u2192 ${b.to})`),
        confirmText: 'Set filtered',
        cancelText: 'Cancel',
      });
      if (!ok) return;
      for (const b of bumps) setCurrent(b.node, b.to);
    });
  }

  if (elements.planFilteredBtn) {
    elements.planFilteredBtn.addEventListener('click', async () => {
      const treeId = state.activeTree;
      const tree = TREES[treeId];
      if (!state.filter.active) return;
      const books = state.filter.books || 0;
      const gems  = state.filter.gems  || 0;
      // Plan up to the highest level the budget allows starting from the
      // current level. Skip nodes that are already planned at or above that.
      const bumps = [];
      for (const node of tree.nodes.values()) {
        if (isLocked(tree, node)) continue;
        const cur  = getCurrent(node.nodeId);
        const plan = Math.max(getPlanned(node.nodeId) || 0, cur);
        if (plan >= node.maxLevel) continue;
        const target = maxAffordableLevel(node, cur, books, gems);
        if (target > plan) bumps.push({ node, from: plan, to: target });
      }
      if (bumps.length === 0) return;
      const ok = await confirmModal({
        title: `Plan filtered in ${tree.label}`,
        message: `Plan every unlocked node to the highest level its budget allows (${bumps.length} node${bumps.length === 1 ? '' : 's'}):`,
        items: bumps.map(b => `${b.node.displayName}  (planned Lv.${b.from} \u2192 ${b.to})`),
        confirmText: 'Plan filtered',
        cancelText: 'Cancel',
      });
      if (!ok) return;
      for (const b of bumps) setPlanned(b.node, b.to);
    });
  }

  if (elements.totalsExpand) {
    elements.totalsExpand.addEventListener('click', () => {
      totalsCollapsed = !totalsCollapsed;
      elements.totalsExpand.setAttribute('aria-expanded', String(!totalsCollapsed));
      elements.totalsExpand.textContent = totalsCollapsed ? '\u25B8' : '\u25BE';
      const totalsDiv = elements.totalsExpand.closest('.side-card').querySelector('.totals');
      if (totalsDiv) totalsDiv.style.display = totalsCollapsed ? 'none' : '';
      if (elements.advancedToggle) elements.advancedToggle.hidden = totalsCollapsed;
      if (totalsCollapsed && elements.totalsDetail) {
        elements.totalsDetail.classList.remove('open');
        advancedExpanded = false;
        if (elements.advancedToggle) elements.advancedToggle.textContent = 'Show Advanced';
      }
    });
  }

  if (elements.advancedToggle) {
    elements.advancedToggle.addEventListener('click', () => {
      advancedExpanded = !advancedExpanded;
      elements.advancedToggle.textContent = advancedExpanded ? 'Hide Advanced' : 'Show Advanced';
      if (elements.totalsDetail) {
        elements.totalsDetail.classList.toggle('open', advancedExpanded);
      }
    });
  }

  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', () => {
      const code = encode();
      copyableModal({
        title: 'Share code',
        message: 'Copy this code and share it. Others can paste it into Load to reproduce your build.',
        value: code,
        dismissText: 'Close',
      });
    });
  }

  if (elements.loadBtn) {
    elements.loadBtn.addEventListener('click', async () => {
      const code = await promptModal({
        title: 'Load build',
        message: 'Paste a share code to load a saved build. This will replace your current levels and plans across both trees.',
        placeholder: 'Paste share code here…',
        confirmText: 'Load',
        cancelText: 'Cancel',
      });
      if (!code) return;
      const ok = applyCode(code);
      if (!ok) {
        await confirmModal({
          title: 'Invalid code',
          message: 'The share code could not be parsed. Make sure you copied the full code.',
          confirmText: 'OK',
          cancelText: 'OK',
        });
      }
    });
  }
}

// Detailed breakdown rendering (chips, ID→colour map, etc.) lives in
// ./totalsDetail.js. We just call it from renderTopbar() below.

export function renderTopbar() {
  // Active tab styling
  elements.tabs.querySelectorAll('button[data-tree]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tree === state.activeTree);
  });

  // Cost prediction — active tree only
  const tree = TREES[state.activeTree];
  let books = 0, minutes = 0, paid = 0;
  for (const node of tree.nodes.values()) {
    const cur = state.current[node.nodeId] || 0;
    const plan = Math.max(state.planned[node.nodeId] || 0, cur);
    if (plan > cur) {
      const r = rangeCost(node, cur, plan);
      books += r.books;
      minutes += r.minutes;
      paid += r.paidMinutes;
    }
  }
  const gems = Math.ceil(paid) * tree.gemsPerMin;
  elements.statBooks.textContent = formatNumber(books);
  elements.statGems.textContent  = formatNumber(gems);
  // True time (after ads) is the headline; raw is the small subline.
  elements.statTime.textContent  = formatMinutes(paid);
  elements.statTimeSub.textContent = `${formatMinutes(minutes)} before ads`;
  elements.treeLabel.textContent = tree.label;
  if (elements.costTreeName) elements.costTreeName.textContent = tree.label;
  if (elements.costGpm) elements.costGpm.textContent = `· 1 min = ${tree.gemsPerMin} gems`;

  // Swap the cost-prediction currency icon to match the active tree.
  if (elements.statCostIco) {
    elements.statCostIco.className = 'ico ' + (tree.id === 'specialization' ? 'ico-spec' : 'ico-adv');
  }
  if (elements.statCostLbl) {
    elements.statCostLbl.textContent = tree.id === 'specialization' ? 'spec. currency' : 'adv. currency';
  }

  // Keep filter inputs in sync (state can be mutated elsewhere e.g. on load).
  if (document.activeElement !== elements.filterBooks) elements.filterBooks.value = state.filter.books || 0;
  if (document.activeElement !== elements.filterGems)  elements.filterGems.value  = state.filter.gems  || 0;
  elements.filterToggle.checked = !!state.filter.active;
  if (elements.filterAccumulative) elements.filterAccumulative.checked = state.filter.accumulative !== false;
  if (elements.setFilteredBtn) elements.setFilteredBtn.hidden = !state.filter.active;
  if (elements.planFilteredBtn) elements.planFilteredBtn.hidden = !state.filter.active;

  // Cross-tree totals
  const totals = computeTotals();
  if (elements.totalAtk) elements.totalAtk.textContent = `+${totals.atk}%`;
  if (elements.totalDef) elements.totalDef.textContent = `+${totals.def}%`;
  if (elements.totalHp)  elements.totalHp.textContent  = `+${totals.hp}%`;
  if (elements.totalAdvSpent)  elements.totalAdvSpent.textContent  = formatNumber(totals.advSpent);
  if (elements.totalSpecSpent) elements.totalSpecSpent.textContent = formatNumber(totals.specSpent);

  renderTotalsDetail(elements.totalsDetail);
}

// Help / how-to dialog opened from the round info button next to the search.
// Content is author-authored HTML; do NOT interpolate user data here.
function openHelpModal() {
  const html = `
    <div class="app-modal-help">
      <div class="notice"><b>Heads up:</b> all gem costs shown here are already discounted by
      the ad reward. If you don't have the ads pass, the real gem cost is roughly double what you see.</div>

      <p>The simulator helps you plan and track Adventure and Specialization skill-tree spending
      from the in-game Rogue Legend trees.</p>

      <h3>Setting &amp; planning levels</h3>
      <ul>
        <li>Click <kbd>Set</kbd> next to a level in a node's popup to mark that level as already
        purchased in-game.</li>
        <li>Click <kbd>Plan</kbd> to queue a level without spending it &mdash; planned cost is
        shown in the totals row so you can budget ahead.</li>
        <li>Use <kbd>Set</kbd> / <kbd>Plan</kbd> on a <i>locked</i> node and the simulator will
        automatically set or plan level 1 of every prerequisite needed to unlock it.</li>
        <li><kbd>Set Planned</kbd> in the top right promotes every planned level in the active
        tree to "current".</li>
      </ul>

      <h3>Search</h3>
      <ul>
        <li>Type in the search box to highlight matching nodes and unlocked skills.
        Matches glow <span class="swatch-search">cyan</span>.</li>
        <li>Press <kbd>Esc</kbd> while focused on the search box to clear it.</li>
      </ul>

      <h3>Skill descriptions</h3>
      <ul>
        <li><span class="swatch-green">Green</span> numbers are the skill's base value.</li>
        <li><span class="swatch-purple">Purple</span> numbers are the upgraded "+" value some
        skills can roll into mid-run.</li>
        <li><span class="swatch-red">Red</span> text marks the drawback / trade-off clause of a
        skill (e.g. "no longer applies Wound").</li>
        <li>The skill name is tinted by its rarity (common, legendary, mythic) and the
        "New / Upgrade Skill" label matches the action colour.</li>
      </ul>

      <h3>Budget filter</h3>
      <ul>
        <li>Enter your current book and gem stockpile, then toggle the filter
        <kbd>On</kbd> &mdash; affordable next steps are highlighted.</li>
        <li>Keep <kbd>Accum.</kbd> on to highlight nodes whose total cost from your current level
        fits the budget. Switch it off to highlight any single level whose individual cost fits.</li>
        <li><kbd>Set Filtered</kbd> appears next to the budget inputs while the filter is on
        &mdash; it promotes every highlighted node in the active tree to the highest level its
        budget allows.</li>
        <li><kbd>Plan Filtered</kbd> does the same thing but as a <i>plan</i> instead of a
        purchase, so you can preview the spend in the cost row without committing.</li>
      </ul>

      <div class="tip">
        <b>Tip:</b> if nothing lights up with the filter on, slowly increase the book / gem values
        until results appear. The first node to highlight is your cheapest next upgrade &mdash;
        especially handy when hunting % stat nodes.
      </div>

      <h3>Other useful bits</h3>
      <ul>
        <li>Tabs at the bottom switch between the Adventure and Specialization trees; totals on
        the right are tracked across <i>both</i> trees.</li>
        <li>Click <kbd>▾</kbd> next to "Totals" to collapse the panel; click <kbd>Show Advanced</kbd>
        for the per-pet / sentinel / mount / PvP breakdown.</li>
        <li>With a node popup open, press <kbd>1</kbd>&ndash;<kbd>9</kbd> to set its level
        (<kbd>0</kbd>&nbsp;=&nbsp;level&nbsp;10). Exceeding the max clamps to max.</li>
        <li><kbd>Reset</kbd> clears all levels and plans in the <i>active</i> tree only;
        budget-filter settings are preserved.</li>
        <li>Planned levels are marked in <span class="swatch-plan">pink</span> on the canvas and
        in the popup so you can spot them at a glance.</li>
        <li><kbd>Save</kbd> generates a compact share code you can send to others or bookmark.
        <kbd>Load</kbd> restores a build from a pasted share code (replaces both trees).</li>
        <li>Everything is also saved to your browser's local storage &mdash; refreshing or closing the
        tab will not lose your progress.</li>
      </ul>
    </div>
  `;
  infoModal({ title: 'How to use the simulator', html, dismissText: 'Close' });
}

