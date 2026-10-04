import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTokens } from './tokens';

const css = readFileSync(join(import.meta.dirname, '../styles/tokens.css'), 'utf8');

describe('parseTokens', () => {
  const groups = parseTokens(css);

  it('reads every group in tokens.css', () => {
    expect(groups.map((g) => g.name)).toEqual(['colour', 'type', 'shape', 'depth', 'spacing (4px base)', 'motion']);
  });

  it('reads every token in the :root block', () => {
    const declared = css.slice(0, css.indexOf('@media')).match(/--[\w-]+\s*:/g) ?? [];
    expect(groups.flatMap((g) => g.tokens)).toHaveLength(declared.length);
  });

  it('keeps names and values', () => {
    const colour = groups[0].tokens;
    expect(colour[0]).toEqual({ name: '--color-bg', value: '#F3F1FA' });
  });

  it('ignores the reduced-motion overrides', () => {
    const motion = groups.find((g) => g.name === 'motion');
    expect(motion?.tokens.find((t) => t.name === '--dur-snap')?.value).toBe('160ms');
  });
});
