// Loader for the per-node metadata + per-level unlocked-skill data dumped
// from the game (skill_tree_nodes.json, node_skills.json).
//
// Both files key by `localDataId` (e.g. "adventure_combo_enhancement_1").
// We expose synchronous lookups after `loadSkillMeta()` resolves.

const META_PATH   = 'skilltree_0471/skill_tree_nodes.json';
const SKILLS_PATH = 'skilltree_0471/node_skills.json';

const META = new Map();        // localDataId -> meta entry
const SKILLS = new Map();      // localDataId -> sorted skills array

// Game asset paths use Windows-style backslashes; the icons live under
// `skilltree_0471/icons/<basename>`. We never want to leak a leading slash.
function fixIconPath(s) {
  if (!s) return '';
  const norm = s.replace(/\\/g, '/').replace(/^\/+/, '');
  // Most entries already start with `icons/...`; some may not. Always anchor
  // under the captured dump folder so the browser can fetch them.
  if (norm.startsWith('skilltree_0471/')) return norm;
  if (norm.startsWith('icons/')) return 'skilltree_0471/' + norm;
  return 'skilltree_0471/icons/' + norm;
}

export async function loadSkillMeta() {
  const [metaRes, skillsRes] = await Promise.all([
    fetch(META_PATH),
    fetch(SKILLS_PATH),
  ]);
  if (!metaRes.ok)   throw new Error(`Failed to load ${META_PATH} (${metaRes.status})`);
  if (!skillsRes.ok) throw new Error(`Failed to load ${SKILLS_PATH} (${skillsRes.status})`);
  const metaArr   = await metaRes.json();
  const skillsDoc = await skillsRes.json();

  for (const entry of metaArr) {
    if (!entry || !entry.node_id) continue;
    META.set(entry.node_id, {
      displayName: entry.display_name || entry.m_name || entry.node_id,
      iconPath: fixIconPath(entry.icon_file),
      iconSprite: entry.icon_sprite_name || '',
      overlayIconPath: fixIconPath(entry.specialization_icon_file),
      tailLabels: entry.tail_labels || [],
      levelValues: entry.level_values || [],
      description: entry.description || '',
    });
  }

  for (const group of (skillsDoc.groups || [])) {
    if (!group || !group.node_id) continue;
    const skills = (group.skills || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(s => ({
        order: s.order,
        type: s.type || '',
        name: s.name || '',
        rarity: (s.rarity || 'common').toLowerCase(),
        description: s.description || '',
        iconPath: fixIconPath(s.icon_file),
      }));
    SKILLS.set(group.node_id, skills);
  }
}

export function getNodeMeta(localDataId) {
  return META.get(localDataId) || null;
}

export function getNodeSkillsByLocalId(localDataId) {
  return SKILLS.get(localDataId) || [];
}

// Lowercased, concatenated text used for full-text search of a node:
// node display name + node description + every skill name/type/description.
const SEARCH_CACHE = new Map(); // localDataId -> string
export function getNodeSearchText(localDataId, displayName = '') {
  const key = localDataId || displayName;
  if (SEARCH_CACHE.has(key)) return SEARCH_CACHE.get(key);
  const meta = META.get(localDataId);
  const parts = [];
  if (displayName) parts.push(displayName);
  if (meta) {
    if (meta.displayName) parts.push(meta.displayName);
    if (meta.description) parts.push(meta.description);
  }
  for (const s of (SKILLS.get(localDataId) || [])) {
    if (s.name) parts.push(s.name);
    if (s.type) parts.push(s.type);
    if (s.description) parts.push(s.description);
  }
  const text = parts.join('\n').toLowerCase();
  SEARCH_CACHE.set(key, text);
  return text;
}

export function skillMatchesQuery(skill, q) {
  if (!q) return false;
  const needle = q.toLowerCase();
  return (
    (skill.name && skill.name.toLowerCase().includes(needle)) ||
    (skill.type && skill.type.toLowerCase().includes(needle)) ||
    (skill.description && skill.description.toLowerCase().includes(needle))
  );
}
