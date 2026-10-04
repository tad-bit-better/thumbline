import { TICKS_PER_BEAT } from '../constants.js';
import type { Level, Style } from '../types.js';
import { LEVELS, PATTERNS, getPattern, patternsFor } from './index.js';

const STYLES: Style[] = ['arpeggio', 'fingerstyle', 'flamenco'];

describe('pattern library', () => {
  it('has unique ids of the form style.level.name', () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PATTERNS) {
      expect(p.id).toMatch(new RegExp(`^${p.style}\\.${p.level}\\.[a-z0-9-]+$`));
    }
  });

  it.each(STYLES.flatMap((s) => LEVELS.map((l) => [s, l] as [Style, Level])))(
    '%s %s has at least two patterns',
    (style, level) => {
      expect(patternsFor(style, level).length).toBeGreaterThanOrEqual(2);
    },
  );

  describe.each(PATTERNS.map((p) => [p.id, p]))('%s', (_id, p) => {
    it('has a name and a one-sentence hint', () => {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.hint).toMatch(/^[A-Z].*\.$/);
    });

    it('has events for exactly the meters it supports', () => {
      for (const m of [3, 4, 12] as const) {
        expect(p.events[m] !== undefined).toBe(p.meters.includes(m));
      }
    });

    it.each(p.meters.map((m) => [m]))('%i-beat events fit in one bar and start with a bass note', (m) => {
      const events = p.events[m] ?? [];
      const bar = m * TICKS_PER_BEAT;
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toMatchObject({ tick: 0, target: 'bass', finger: 'p' });
      for (const e of events) {
        expect(e.tick).toBeGreaterThanOrEqual(0);
        expect(e.tick).toBeLessThan(bar);
        expect(e.dur).toBeGreaterThan(0);
        if (e.velocity !== undefined) {
          expect(e.velocity).toBeGreaterThan(0);
          expect(e.velocity).toBeLessThanOrEqual(1);
        }
      }
      const ticks = events.map((e) => e.tick);
      expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    });

    it('uses the thumb only on bass strings and fingers only on treble strings', () => {
      for (const events of Object.values(p.events)) {
        for (const e of events ?? []) {
          if (e.target === 'bass' || e.target === 'altBass' || e.target === 't4') {
            expect(e.finger).toBe('p');
          } else if (e.target === 'all' && (e.tech === 'rasgueo-down' || e.tech === 'rasgueo-up')) {
            // A strum: any finger, the thumb included (alzapúa).
          } else {
            expect(e.finger).not.toBe('p');
          }
        }
      }
    });

    it('names its palos when it is flamenco', () => {
      if (p.style === 'flamenco') expect(p.palos?.length).toBeGreaterThan(0);
      else expect(p.palos).toBeUndefined();
    });
  });
});

describe('getPattern / patternsFor', () => {
  it('finds patterns by id', () => {
    expect(getPattern('fingerstyle.moderate.travis')?.name).toBe('Travis picking');
    expect(getPattern('nope')).toBeUndefined();
  });

  it('filters by meter', () => {
    expect(patternsFor('arpeggio', 'basic', 3).length).toBeGreaterThan(0);
    expect(patternsFor('arpeggio', 'basic', 12)).toEqual([]);
  });
});
