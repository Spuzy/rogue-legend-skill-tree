// Renders the inline coloured spans the game uses inside skill descriptions:
//   `!value!`  → green  (the base value, e.g. "+125%")
//   `{value}`  → purple (the upgraded "+" version of the skill)
//   `'word'`   → blue   (matches the in-game keyword highlight)
// Other text is left as plain HTML-escaped content.

export function formatSkillDescription(text) {
  if (!text) return '';
  // Escape HTML first to avoid injection from upstream JSON. The braces are
  // escaped as well so a custom marker survives until our replace step.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/!([^!]+)!/g, '<span class="skill-emph">$1</span>')
    .replace(/\{([^}]+)\}/g, '<span class="skill-upgrade">$1</span>')
    .replace(/'([^']+)'/g, '<span class="skill-keyword">$1</span>');
}
