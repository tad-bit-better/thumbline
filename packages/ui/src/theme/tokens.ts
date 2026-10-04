export type TokenGroup = { name: string; tokens: Array<{ name: string; value: string }> };

/**
 * Parse the `:root` block of tokens.css into groups, using its
 * `/* group *\/` comments as headings. Used by the Theme story.
 */
export function parseTokens(css: string): TokenGroup[] {
  const root = css.slice(css.indexOf(':root'), css.indexOf('@media'));
  const groups: TokenGroup[] = [];
  let current: TokenGroup | undefined;
  const re = /\/\*\s*([^*]+?)\s*\*\/|(--[\w-]+)\s*:\s*([^;]+);/g;
  for (const m of root.matchAll(re)) {
    if (m[1] !== undefined) {
      current = { name: m[1], tokens: [] };
      groups.push(current);
    } else if (current) {
      current.tokens.push({ name: m[2], value: m[3].trim() });
    }
  }
  return groups.filter((g) => g.tokens.length > 0);
}
