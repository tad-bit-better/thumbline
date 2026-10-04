import { chordTones } from './chords.js';
import { OPEN_PC } from './constants.js';
import type { ChordLabel, Voicing } from './types.js';

export type StringFret = { string: number; fret: number };

/**
 * Alternate bass note for a voicing (engine-spec §4):
 * root on string 0 → string 2, else 1; root on string 1 → string 2;
 * root on string ≥ 2 → an open lower string that's a chord tone (A, then E),
 * else the string above the root.
 */
export function altBass(voicing: Voicing, played: ChordLabel): StringFret | null {
  const { frets, rootString } = voicing;
  const sounded = (s: number): StringFret | null =>
    s < frets.length && frets[s] >= 0 ? { string: s, fret: frets[s] } : null;

  if (rootString === 0) return sounded(2) ?? sounded(1);
  if (rootString === 1) return sounded(2);

  const tones = chordTones(played);
  for (const s of [1, 0]) {
    // Fretted lower strings are part of the shape; only an open string is free to use.
    if (frets[s] <= 0 && tones.has(OPEN_PC[s])) return { string: s, fret: 0 };
  }
  return sounded(rootString + 1);
}
