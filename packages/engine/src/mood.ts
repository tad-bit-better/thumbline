import { TICKS_PER_BEAT } from './constants.js';
import type { AnalysisResult, BeatsPerBar, Mood, MoodLabel, NoteEvent, SectionLevel } from './types.js';

export const MOODS: readonly MoodLabel[] = ['melancholic', 'warm', 'intense', 'upbeat'];

/** Above this, energy reads as driving and valence as bright. */
const MIDDLE = 0.5;

/** engine-spec §4 mood: the quadrant of (energy, valence). */
export function moodLabelOf(m: Mood): MoodLabel {
  const driving = m.energy >= MIDDLE;
  const bright = m.valence >= MIDDLE;
  if (driving) return bright ? 'upbeat' : 'intense';
  return bright ? 'warm' : 'melancholic';
}

/** The middle of each mood's quadrant: what a preset sets the sliders to. */
export const MOOD_CENTRES: Readonly<Record<MoodLabel, Mood>> = {
  melancholic: { energy: 0.25, valence: 0.25 },
  warm: { energy: 0.25, valence: 0.75 },
  intense: { energy: 0.75, valence: 0.25 },
  upbeat: { energy: 0.75, valence: 0.75 },
};

/** A label or values → values (a label is its quadrant's centre). */
export const moodValuesOf = (m: MoodLabel | Mood): Mood => (typeof m === 'string' ? MOOD_CENTRES[m] : m);

/**
 * engine-spec §4 touch, from the mood's values (pattern notes only; the tune
 * keeps its own length and weight):
 * - velocity × (0.8 + 0.25 × energy), at most 1: calm songs play softer;
 * - calm (energy under 0.5): only the accent on a bar's first beat stays, and
 *   palm mutes go (a muted bass thuds on a ballad; the string rings instead);
 * - driving: the thumb is cut to an eighth so the bass pulses;
 * - driving and bright: every pattern note is cut to an eighth so it bounces.
 */
export function applyTouch(events: NoteEvent[], mood: MoodLabel | Mood, beatsPerBar: BeatsPerBar): void {
  const { energy, valence } = moodValuesOf(mood);
  const velocity = 0.8 + 0.25 * energy;
  const driving = energy >= MIDDLE;
  const crisp = driving && valence >= MIDDLE;
  const eighth = TICKS_PER_BEAT / 2;
  const bar = beatsPerBar * TICKS_PER_BEAT;
  for (const e of events) {
    if (e.melody) continue;
    e.velocity = Math.min(1, Math.round(e.velocity * velocity * 100) / 100);
    if (e.accent && !driving && e.tick % bar !== 0) delete e.accent;
    if (e.fret < 0) continue;
    if (e.tech === 'palm-mute' && !driving) delete e.tech;
    if ((e.finger === 'p' && driving) || crisp) e.dur = Math.min(e.dur, eighth);
  }
}

/** Bars per phrase when reading the song's loudness: sections move in phrases, not bars. */
const PHRASE_BARS = 4;
/** Below this spread between the song's quiet and loud levels, it doesn't build: all normal. */
const MIN_CONTRAST = 0.08;
/** The quietest and loudest quarter of that spread are soft and full. */
const EDGE = 0.25;

/**
 * engine-spec §4 sections: each bar's loudness (mean of its beats), averaged
 * over 4-bar phrases, compared with the song's own quiet and loud levels (the
 * 20th and 80th percentile of its phrases): phrases in the quietest quarter of
 * that spread are soft, in the loudest quarter full, the rest normal. A song
 * whose levels are less than 0.08 apart stays normal throughout. Relative, so
 * a mastered pop verse that is only a little quieter than its chorus still reads.
 */
export function sectionsOf(input: Pick<AnalysisResult, 'beatEnergy' | 'barStartBeat'>, beatsPerBar: BeatsPerBar, bars: number): SectionLevel[] {
  const energy = input.beatEnergy;
  if (!energy?.length || bars === 0) return Array.from({ length: bars }, () => 'normal');
  const barEnergy = Array.from({ length: bars }, (_, b) => {
    const from = input.barStartBeat + b * beatsPerBar;
    const beats = energy.slice(Math.max(0, from), Math.max(0, from + beatsPerBar));
    return beats.length ? beats.reduce((a, x) => a + x, 0) / beats.length : 0;
  });
  const phrase = barEnergy.map((_, b) => {
    const start = Math.floor(b / PHRASE_BARS) * PHRASE_BARS;
    const group = barEnergy.slice(start, start + PHRASE_BARS);
    return group.reduce((a, x) => a + x, 0) / group.length;
  });
  const sorted = [...phrase].sort((a, b) => a - b);
  const quiet = sorted[Math.floor((sorted.length - 1) * 0.2)];
  const loud = sorted[Math.floor((sorted.length - 1) * 0.8)];
  const spread = loud - quiet;
  if (spread < MIN_CONTRAST) return phrase.map(() => 'normal');
  return phrase.map((p) => (p <= quiet + EDGE * spread ? 'soft' : p >= loud - EDGE * spread ? 'full' : 'normal'));
}

const SOFT_VELOCITY = 0.8;
const FULL_VELOCITY = 1.1;

/**
 * engine-spec §4 sections, applied: soft bars keep the tune, the bass and
 * notes on the beat, softer; full bars play everything a little harder with
 * the bar's first beat accented. Returns the notes to keep.
 */
export function applySections(events: NoteEvent[], sections: readonly SectionLevel[], beatsPerBar: BeatsPerBar): NoteEvent[] {
  const bar = beatsPerBar * TICKS_PER_BEAT;
  const out: NoteEvent[] = [];
  for (const e of events) {
    const level = sections[Math.floor(e.tick / bar)] ?? 'normal';
    if (level === 'soft' && !e.melody) {
      const onBeat = e.tick % TICKS_PER_BEAT === 0;
      if (!onBeat && e.finger !== 'p' && e.fret >= 0) continue;
      e.velocity = Math.round(e.velocity * SOFT_VELOCITY * 100) / 100;
    }
    if (level === 'full' && !e.melody) {
      e.velocity = Math.min(1, Math.round(e.velocity * FULL_VELOCITY * 100) / 100);
      if (e.tick % bar === 0) e.accent = true;
    }
    out.push(e);
  }
  return out;
}

/** Order a level's patterns so the ones that suit the mood come first (stable otherwise). */
export function byMood<T extends { moods?: readonly MoodLabel[] }>(patterns: readonly T[], mood?: MoodLabel): T[] {
  if (!mood) return [...patterns];
  return [...patterns].sort((a, b) => Number(!a.moods?.includes(mood)) - Number(!b.moods?.includes(mood)));
}
