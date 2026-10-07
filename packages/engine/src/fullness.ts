import { TICKS_PER_BEAT } from './constants.js';
import type { Level } from './types.js';

/** engine-spec §4 fullness: 1 (sparse) to 10 (full); 5 plays as before the setting existed. */
export const DEFAULT_FULLNESS = 5;
export const MIN_FULLNESS = 1;
export const MAX_FULLNESS = 10;

const BEAT = TICKS_PER_BEAT;

/** A fill's rhythm: how long it lasts and where its notes fall, ticks from its start. */
export type FillRhythm = { span: number; at: number[] };

/** How much harmony goes under the tune, from the level's own rule upward. */
export type HarmonyRule = 'none' | 'moderate' | 'advanced' | 'rich' | 'richest';

export type FullnessRules = {
  /** The tune's grid: one note per beat (Basic's), or onsets on this many ticks. */
  tuneGrid: 'beat' | number;
  /** The tune must rest this long before a fill comes in; null = no fills. */
  fillRest: number | null;
  /** Fill rhythms, longest first: the longest that fits the rest is played. */
  fillRhythms: FillRhythm[];
  /** A rest shorter than the longest rhythm still gets its tail (from the first eighth inside the rest), when longer than the next rhythm. */
  fillTrim: boolean;
  /** Bars without a tune get a moving top line and runs into their chord changes, at this level's rules; null = left as they are. */
  tunelessRuns: Level | null;
  /** The guitar answers the tune: echoes in its pauses (Moderate, Advanced), a counter-line under held notes (Advanced). */
  echo: boolean;
  counterLine: boolean;
  harmony: HarmonyRule;
  /** Walking bass at this level's count of notes, into chords at least `walkMinChord` long; null = none. */
  walk: Level | null;
  walkMinChord: number;
  /** While a tune note sounds the pattern's finger notes give way: 'all' of them, the 'offbeat' ones, or none. */
  thin: 'all' | 'offbeat' | null;
};

const PICKUP: FillRhythm = { span: BEAT / 2, at: [0] };
const FILLS: Record<'moderate' | 'moderate+' | 'advanced' | 'advanced+', FillRhythm[]> = {
  // Two eighths in the last beat.
  moderate: [{ span: BEAT, at: [0, 240] }],
  // Eighths over the last two beats, or the last one; a half-beat rest gets a pickup.
  'moderate+': [{ span: 2 * BEAT, at: [0, 240, 480, 720] }, { span: BEAT, at: [0, 240] }, PICKUP],
  // Two eighths then four sixteenths over the last two beats, or four sixteenths in the last.
  advanced: [
    { span: 2 * BEAT, at: [0, 240, 480, 600, 720, 840] },
    { span: BEAT, at: [0, 120, 240, 360] },
  ],
  // As Advanced, led in by a beat of eighths when three beats are free.
  'advanced+': [
    { span: 3 * BEAT, at: [0, 240, 480, 720, 960, 1080, 1200, 1320] },
    { span: 2 * BEAT, at: [0, 240, 480, 600, 720, 840] },
    { span: BEAT, at: [0, 120, 240, 360] },
    PICKUP,
  ],
};
const HARMONY_STEPS: HarmonyRule[] = ['moderate', 'advanced', 'rich', 'richest'];

/**
 * engine-spec §4 fullness: what a setting changes, for a level. The setting
 * fills silences and adds harmony; it never makes the rhythm faster than the
 * level's (Basic's beats and eighths, 16ths above), and Basic stays plain until 8.
 *
 * - 1–2: no fills, harmony or walking bass; while the tune sounds the pattern's
 *   finger notes give way (1: all of them, 2: those off the beat). Moderate and
 *   Advanced hear the tune on eighths.
 * - 3–4: fills only into rests of two beats or more; no harmony at 3, none of
 *   the walking bass at 3–4; the tune on eighths at 3.
 * - 5–6: as the level always played.
 * - 7–8: fills into rests of half a beat or more, longer runs (Moderate: eighths
 *   over two beats; Advanced: a beat of eighths before its run when three beats
 *   are free), harmony one step richer, the bass walks into chords of two beats
 *   or more. Basic, from 8: hears the tune on eighths, and fills, harmonises and
 *   walks like Moderate.
 * - 7–10: a rest too short for the longest run gets the run's tail, from the
 *   first eighth inside the rest, when that keeps more notes than a shorter run.
 * - 7–10, bars without a tune: a moving top line, and runs into chord changes
 *   (the fill rhythms, at most half the outgoing chord).
 * - 9–10: harmony two steps richer; the guitar answers the tune: an echo of a
 *   phrase's end in its pauses (Moderate, Advanced) and a counter-line under
 *   held notes (Advanced). Basic stays as at 8.
 */
export function fullnessRules(fullness: number, level: Level): FullnessRules {
  const f = fullness;
  // Basic only joins in from 8, at Moderate's rules.
  const as: Level | null = level === 'basic' ? (f >= 8 ? 'moderate' : null) : level;
  const tuneGrid = level === 'basic' ? (f >= 8 ? BEAT / 2 : 'beat') : f <= 3 ? BEAT / 2 : BEAT / 4;
  const fillRest = !as || f <= 2 ? null : f <= 4 ? 2 * BEAT : f <= 6 ? BEAT : BEAT / 2;
  const fillRhythms = !as ? [] : as === 'advanced' ? FILLS[f >= 7 ? 'advanced+' : 'advanced'] : f >= 7 && level !== 'basic' ? FILLS['moderate+'] : level === 'basic' ? [...FILLS.moderate, PICKUP] : FILLS.moderate;
  const steps = f >= 9 ? 2 : f >= 7 ? 1 : 0;
  const harmony: HarmonyRule = !as || f <= 3 ? 'none' : HARMONY_STEPS[Math.min(HARMONY_STEPS.length - 1, HARMONY_STEPS.indexOf(as as HarmonyRule) + (level === 'basic' ? 0 : steps))];
  return {
    tuneGrid,
    fillRest,
    fillRhythms,
    harmony,
    fillTrim: f >= 7 && !!as,
    tunelessRuns: f >= 7 ? as : null,
    echo: f >= 9 && level !== 'basic',
    counterLine: f >= 9 && level === 'advanced',
    walk: !as || f <= 4 ? null : as,
    walkMinChord: f >= 7 ? 2 * BEAT : 3 * BEAT,
    thin: f === 1 ? 'all' : f === 2 ? 'offbeat' : null,
  };
}

export function checkFullness(fullness: number) {
  if (!Number.isInteger(fullness) || fullness < MIN_FULLNESS || fullness > MAX_FULLNESS) {
    throw new Error(`Fullness must be a whole number from 1 to 10, got ${fullness}`);
  }
}
