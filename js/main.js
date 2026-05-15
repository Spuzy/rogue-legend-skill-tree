// Bootstrap.

import { subscribe, state, setCurrent } from './core/state.js';
import { initRender, render, centerTree } from './render/index.js';
import { initPopup, refreshPopup, closePopup, getPopupNode } from './ui/popup/index.js';
import { initTopbar, renderTopbar } from './ui/topbar/index.js';
import { loadSkillMeta, getNodeMeta } from './core/skill_meta.js';
import { enrichTreesWithMeta } from './core/data.js';
import { $ } from './ui/dom.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Load the dumped metadata before the first render so node names, icons,
  // and per-level skill entries are in place from frame zero.
  try {
    await loadSkillMeta();
    enrichTreesWithMeta(getNodeMeta);
  } catch (err) {
    const b = document.getElementById('boot-error');
    if (b) {
      b.style.display = 'block';
      b.innerHTML = '<b>Failed to load skill metadata.</b><br>' +
        'Make sure you opened the page through <code>serve.bat</code> ' +
        '(<code>http://localhost:8000/</code>) and that ' +
        '<code>skilltree_0471/skill_tree_nodes.json</code> and ' +
        '<code>skilltree_0471/node_skills.json</code> exist.<br>' +
        '<small>' + (err && err.message ? err.message : err) + '</small>';
    }
    // Continue anyway with the CSV-only data so the tree still renders.
  }

  initRender($('canvas'));
  initPopup($('popup'));
  initTopbar({
    tabs:          $('tabs'),
    treeLabel:     $('tree-label'),
    statBooks:     $('stat-books'),
    statGems:      $('stat-gems'),
    statTime:      $('stat-time'),
    statTimeSub:   $('stat-time-sub'),
    statCostIco:   $('stat-cost-ico'),
    statCostLbl:   $('stat-cost-lbl'),
    costTreeName:  $('cost-tree-name'),
    filterBooks:   $('filter-books'),
    filterGems:    $('filter-gems'),
    filterToggle:  $('filter-toggle'),
    filterAccumulative: $('filter-accumulative'),
    costGpm:       $('cost-gpm'),
    totalAtk:      $('total-atk'),
    totalDef:      $('total-def'),
    totalHp:       $('total-hp'),
    totalAdvSpent:  $('total-adv-spent'),
    totalSpecSpent: $('total-spec-spent'),
    totalsExpand:   $('totals-expand'),
    totalsDetail:   $('totals-detail'),
    advancedToggle: $('totals-advanced-toggle'),
    resetBtn:      $('reset-btn'),
    setPlannedBtn: $('set-planned-btn'),
    setFilteredBtn:$('set-filtered-btn'),
    planFilteredBtn:$('plan-filtered-btn'),
    searchInput:   $('search-input'),
    searchClear:   $('search-clear'),
  });

  let lastTree = null;
  const refresh = () => {
    if (lastTree !== null && lastTree !== state.activeTree) closePopup();
    renderTopbar();
    render();
    refreshPopup();
    if (lastTree !== state.activeTree) {
      lastTree = state.activeTree;
      centerTree(state.activeTree);
    }
  };
  // Keyboard shortcuts: 1-9 and 0 set the open node's level (0 = level 10).
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const node = getPopupNode();
    if (!node) return;
    const key = e.key;
    if (key >= '0' && key <= '9') {
      const lvl = key === '0' ? 10 : Number(key);
      setCurrent(node, Math.min(lvl, node.maxLevel));
    }
  });

  subscribe(refresh);
  refresh();
  window.__rl_booted = true;
});
