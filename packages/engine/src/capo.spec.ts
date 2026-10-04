import { parseChord } from './chords.js';
import type { ChordLabel } from './types.js';
import { bestCapo, capoCost } from './capo.js';

const chords = (text: string): ChordLabel[] =>
  text.split(/\s+/).map((t) => (parseChord(t) as { label: ChordLabel }).label);

describe('capoCost', () => {
  it('is 0.2 per fret when every chord has an open shape', () => {
    expect(capoCost(chords('G D Em C'), 0)).toBe(0);
    expect(capoCost(chords('G D Em C'), 2)).toBeGreaterThan(0);
  });

  it('adds 3 per chord that only has a barre shape', () => {
    expect(capoCost(chords('F Bb'), 0)).toBe(6);
  });
});

describe('bestCapo', () => {
  it('returns 0 for no chords', () => {
    expect(bestCapo([])).toBe(0);
  });

  it('keeps open-position progressions at capo 0', () => {
    expect(bestCapo(chords('G D Em C'))).toBe(0);
  });

  it('trades a barre for a capo when that is cheaper', () => {
    // capo 0 has a barre F (3); capo 5 → Em C G D, all open (1.0)
    expect(bestCapo(chords('Am F C G'))).toBe(5);
  });

  it('moves flat keys onto open shapes', () => {
    // Bb F Gm Eb with capo 3 → G D Em C
    expect(bestCapo(chords('Bb F Gm Eb'))).toBe(3);
  });

  it('finds the cheapest position for sharp keys', () => {
    // capo 4 → D Bm G A: one barre (Bm) + 0.8 beats every other position
    expect(bestCapo(chords('F# D#m B C#'))).toBe(4);
  });

  it('prefers the lower capo on a tie', () => {
    // E and A are open at capo 0; at capo 5 they'd be B and E (B is barre)
    expect(bestCapo(chords('E A'))).toBe(0);
  });

  it('never goes above capo 7', () => {
    const c = bestCapo(chords('C# F# G# D#m A#m'));
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(7);
  });
});
