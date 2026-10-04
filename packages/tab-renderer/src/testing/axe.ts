import axe from 'axe-core';

/**
 * axe-core violations for a rendered container, as readable strings.
 * Colour contrast is checked in Storybook (jsdom can't compute it).
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}
