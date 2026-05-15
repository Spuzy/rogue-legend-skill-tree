// Node popup menu with the level list + Set / Plan buttons.

import { state, getCurrent, getPlanned, setCurrent, setPlanned } from '../../core/state.js';
import { rangeCost, paidMinutes, formatMinutes, formatNumber, maxAffordableLevel, levelFitsBudget } from '../../core/cost.js';
import { TREES } from '../../core/data.js';
import { isLocked, cascadeRelock, collectPrereqChain } from '../../core/graph.js';
import { getNodeSkillsByLocalId, skillMatchesQuery } from '../../core/skill_meta.js';
import { confirmModal } from '../modal.js';
import { formatSkillDescription } from './skillDescription.js';

let host;       // <div id="popup">
let currentNode = null;

export function getPopupNode() { return currentNode; }

export function initPopup(hostEl) {
  host = hostEl;
  host.classList.add('popup');
  host.style.display = 'none';
}

export function closePopup() {
  if (!currentNode) return;
  currentNode = null;
  host.style.display = 'none';
  host.innerHTML = '';
}

export function openPopup(node /*, nodeGroupEl */) {
  currentNode = node;
  renderPopup();
  host.style.display = 'block';
}

export function refreshPopup() {
  if (currentNode) renderPopup();
}

function isShapeSquare(theme) {
  return theme === 'atk' || theme === 'def' || theme === 'hp';
}

function formatLevelValue(node, i) {
  const arr = node.levelValues;
  if (!arr || !arr.length) return '';
  const v = arr[i];
  if (v == null || Number.isNaN(Number(v))) return '';
  // Drop trailing ".0" but keep real decimals (e.g. 1.5 -> "1.5", 2.0 -> "2").
  const n = Number(v);
  const txt = Number.isInteger(n) ? String(n) : String(n);
  const sign = n > 0 ? '+' : '';
  return `${sign}${txt}%`;
}

function renderPopup() {
  const node = currentNode;
  const tree = TREES[node.treeId];
  const cur = getCurrent(node.nodeId);
  const plan = getPlanned(node.nodeId);
  const proj = rangeCost(node, cur, plan);
  const accumulative = state.filter.accumulative !== false;
  const maxAffordable = state.filter.active && accumulative
    ? maxAffordableLevel(node, cur, state.filter.books, state.filter.gems)
    : 0;
  const locked = isLocked(tree, node);
  const costIcoCls = tree.id === 'specialization' ? 'ico-spec' : 'ico-adv';
  // Compact rows: either an adventure square (atk/def/hp buff) OR any node
  // that has no per-level unlocked-skill entries (e.g. all specialization
  // nodes). The tall layout only makes sense when there are skill rows to
  // show below the per-level meta line.
  const skills = getNodeSkillsByLocalId(node.localDataId);
  const compact = isShapeSquare(node.theme) || skills.length === 0;

  const rows = [];
  for (let lvl = 1; lvl <= node.maxLevel; lvl++) {
    const i = lvl - 1;
    const t = node.minutesByLevel[i];
    const c = node.costByLevel[i];
    const pm = paidMinutes(t);
    const gems = Math.ceil(pm) * tree.gemsPerMin;
    const owned = lvl <= cur;
    const isPlan = lvl === plan && plan > cur;
    const fits = state.filter.active && lvl > cur && (
      accumulative
        ? lvl <= maxAffordable
        : levelFitsBudget(node, i, state.filter.books, state.filter.gems)
    );
    const setTitle = locked
      ? 'title="Locked \u2014 confirming will also set every required prerequisite to level 1"'
      : `title="Set current owned level to ${lvl}"`;
    const planTitle = `title="Plan target level ${lvl}"`;

    if (compact) {
      // Buff nodes: original compact row + effect column when available.
      const eff = formatLevelValue(node, i);
      rows.push(`
        <tr class="${owned ? 'owned' : ''} ${isPlan ? 'is-plan' : ''} ${fits ? 'fits' : ''}">
          <td class="lvl">${lvl}</td>
          <td class="effect">${eff ? `<span class="eff-val">${eff}</span>` : ''}</td>
          <td class="cost">${formatNumber(c)} <span class="ico ${costIcoCls}"></span></td>
          <td class="time">${formatMinutes(t)}</td>
          <td class="gems">${gems ? formatNumber(gems) + ' <span class="ico ico-gem"></span>' : '<span class="free">free</span>'}</td>
          <td class="actions">
            <button data-act="set"  data-lvl="${lvl}" ${setTitle}>Set</button>
            <button data-act="plan" data-lvl="${lvl}" ${planTitle}>Plan</button>
          </td>
        </tr>
      `);
    } else {
      // Skill nodes: tall row with a placeholder slot for unlocked-skill info.
      const eff = formatLevelValue(node, i);
      rows.push(`
        <tr class="lvl-row ${owned ? 'owned' : ''} ${isPlan ? 'is-plan' : ''} ${fits ? 'fits' : ''}">
          <td class="lvl">${lvl}</td>
          <td class="lvl-body">
            <div class="lvl-meta">
              ${eff ? `<span class="effect"><span class="eff-val">${eff}</span></span>` : ''}
              <span class="cost">${formatNumber(c)} <span class="ico ${costIcoCls}"></span></span>
              <span class="time">${formatMinutes(t)}</span>
              <span class="gems">${gems ? formatNumber(gems) + ' <span class="ico ico-gem"></span>' : '<span class="free">free</span>'}</span>
              <span class="lvl-actions">
                <button data-act="set"  data-lvl="${lvl}" ${setTitle}>Set</button>
                <button data-act="plan" data-lvl="${lvl}" ${planTitle}>Plan</button>
              </span>
            </div>
            <div class="skills-list" data-level="${lvl}">
              <!-- Skills unlocked at level ${lvl} will be injected here. -->
            </div>
          </td>
        </tr>
      `);
    }
  }

  const tableHead = compact
    ? `<thead><tr><th>Lvl</th><th>Effect</th><th>Cost</th><th>Time</th><th>Gems (after ads)</th><th></th></tr></thead>`
    : `<thead><tr><th>Lvl</th><th>Effect / cost / time / gems / actions &mdash; unlocked skills below</th></tr></thead>`;

  host.innerHTML = `
    <div class="popup-head">
      <div class="popup-icon-wrap">
        <img class="popup-icon" src="${node.iconPath}" alt="" onerror="this.style.visibility='hidden'">
        ${node.overlayIconPath ? `<img class="popup-icon-overlay" src="${node.overlayIconPath}" alt="" onerror="this.style.visibility='hidden'">` : ''}
      </div>
      <div class="popup-title">
        <div class="name">${node.displayName}</div>
        <div class="sub">
          <span class="cur">${cur}/${node.maxLevel}</span>
          <span class="theme">${node.theme}</span>
          ${node.parentIds.length === 0 ? '<span class="tag root">root</span>' : ''}
          ${locked ? '<span class="tag locked-tag">locked</span>' : ''}
        </div>
      </div>
      <button class="close" aria-label="Close">&times;</button>
    </div>
    <div class="popup-proj">
      <div class="proj-label">Plan ${cur} &rarr; ${plan}</div>
      <div class="proj-stats">
        <span><b>${formatNumber(proj.books)}</b> <span class="ico ${costIcoCls}"></span></span>
        <span><b>${formatNumber(proj.gems)}</b> <span class="ico ico-gem"></span></span>
        <span><b>${formatMinutes(proj.paidMinutes)}</b> after ads</span>
        <span class="muted">(${formatMinutes(proj.minutes)} before ads)</span>
      </div>
    </div>
    <table class="lvl-table">
      ${tableHead}
      <tbody>${rows.join('')}</tbody>
    </table>
    <div class="popup-foot">
      <button class="reset-set">Reset set</button>
      <button class="clear-plan">Clear plan</button>
    </div>
  `;

  host.querySelector('.close').addEventListener('click', closePopup);
  host.querySelector('.clear-plan').addEventListener('click', () => {
    setPlanned(node, getCurrent(node.nodeId));
  });
  host.querySelector('.reset-set').addEventListener('click', () => {
    setCurrent(node, 0);
    setPlanned(node, 0);
    // Cascade: any descendants that are now locked must also be reset.
    cascadeRelock(node);
  });
  host.querySelectorAll('button[data-act]').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', async () => {
      const lvl = Number(btn.dataset.lvl);
      if (btn.dataset.act === 'set') {
        // Set requires every ancestor's CURRENT level >= 1.
        const missing = collectPrereqChain(node, pid => getCurrent(pid) < 1);
        if (missing.length === 0) {
          setCurrent(node, lvl);
          return;
        }
        const ok = await confirmModal({
          title: `Unlock "${node.displayName}"`,
          message: `Setting this node to level ${lvl} will also set the following ${missing.length} prerequisite node${missing.length === 1 ? '' : 's'} to level 1:`,
          items: missing.map(n => n.displayName),
          confirmText: `Set to level ${lvl}`,
          cancelText: 'Cancel',
        });
        if (!ok) return;
        for (const anc of missing) setCurrent(anc, 1);
        setCurrent(node, lvl);
      } else {
        // Plan requires every ancestor's PLANNED level >= 1 (set counts).
        // Only ancestors that are neither set nor planned need a bump.
        const missing = collectPrereqChain(node, pid => getPlanned(pid) < 1);
        if (missing.length === 0) {
          setPlanned(node, lvl);
          return;
        }
        const ok = await confirmModal({
          title: `Plan "${node.displayName}"`,
          message: `Planning this node at level ${lvl} will also plan the following ${missing.length} prerequisite node${missing.length === 1 ? '' : 's'} at level 1:`,
          items: missing.map(n => n.displayName),
          confirmText: `Plan level ${lvl}`,
          cancelText: 'Cancel',
        });
        if (!ok) return;
        for (const anc of missing) setPlanned(anc, 1);
        setPlanned(node, lvl);
      }
    });
  });

  // Populate per-level unlocked skills (skill nodes only). The .skills-list
  // placeholders were emitted above; we fill in the matching skill entry now.
  if (!compact) {
    const q = (state.search || '').trim();
    host.querySelectorAll('.skills-list[data-level]').forEach(slot => {
      const lvl = Number(slot.dataset.level);
      const skill = skills.find(s => s.order === lvl);
      if (!skill) return;
      const rarity = ['common', 'legendary', 'mythic'].includes(skill.rarity) ? skill.rarity : 'common';
      const matches = q && skillMatchesQuery(skill, q);
      // Split "New Skill" / "Upgrade Skill" so we can colour the action word
      // (New = green, Upgrade = purple) and the trailing "Skill" word in gray.
      const rawType = skill.type || 'Skill';
      const typeParts = rawType.match(/^(\S+)\s+(.+)$/);
      const actionWord = typeParts ? typeParts[1] : '';
      const baseWord   = typeParts ? typeParts[2] : rawType;
      const actionClass = actionWord.toLowerCase() === 'new' ? 'skill-action-new'
                        : actionWord.toLowerCase() === 'upgrade' ? 'skill-action-upgrade'
                        : 'skill-action-base';
      const typeHtml = actionWord
        ? `<span class="${actionClass}">${actionWord}</span> <span class="skill-action-base">${baseWord}</span>`
        : `<span class="skill-action-base">${baseWord}</span>`;
      slot.innerHTML = `
        <div class="skill-row r-${rarity}${matches ? ' search-match' : ''}">
          <div class="skill-icon"><img src="${skill.iconPath}" alt="" onerror="this.style.visibility='hidden'"></div>
          <div class="skill-info">
            <div class="skill-name"><span class="skill-type">${typeHtml}</span> &mdash; <span class="skill-name-text">${skill.name}</span><span class="skill-lvl">Lv.${lvl}/${node.maxLevel}</span></div>
            <div class="skill-text">${formatSkillDescription(skill.description)}</div>
          </div>
        </div>
      `;
    });
  }
}

