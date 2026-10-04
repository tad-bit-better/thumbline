import { transpose } from './chords.js';
import type { ChordLabel } from './types.js';
import { getVoicing } from './voicings.js';

export const MAX_CAPO = 7;

const BARRE_COST = 3;
const CAPO_FRET_COST = 0.2;

/** engine-spec §4: 3 per chord that needs a barre, plus 0.2 per capo fret. */
export function capoCost(chords: readonly ChordLabel[], capo: number): number {
  let cost = capo * CAPO_FRET_COST;
  for (const chord of chords) {
    const { voicing } = getVoicing(transpose(chord, -capo), 'moderate');
    if (voicing.barre) cost += BARRE_COST;
  }
  return cost;
}

/**
 * Capo fret (0–7) with the lowest cost; the lower fret wins a tie.
 * Costs use Moderate voicings: Basic substitutions are applied after the capo is chosen.
 */
// MUSIC-REVIEW: one barre (3) outweighs up to 14 capo frets (0.2 each), so the
// optimiser moves the capo far to dodge a single barre: D-major waltz → capo 7,
// C ballad → capo 5 (losing its Am/G walking bass). It also ignores dropped slash
// chords, and at Basic it doesn't see that F→Fmaj7 would avoid the barre anyway.
export function bestCapo(chords: readonly ChordLabel[]): number {
  let best = 0;
  let bestCost = Infinity;
  for (let capo = 0; capo <= MAX_CAPO; capo++) {
    const cost = capoCost(chords, capo);
    if (cost < bestCost - 1e-9) {
      best = capo;
      bestCost = cost;
    }
  }
  return best;
}
