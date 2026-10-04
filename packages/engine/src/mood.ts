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

/** How each mood touches the strings (engine side; playback adds tone, room and strum speed). */
const TOUCH: Record<MoodLabel, { velocity: number; accents: 'downbeat' | 'all'; maxDur?: number; bassMaxDur?: number }> = {
  // Soft, only the bar's first beat leans; everything rings.
  melancholic: { velocity: 0.85, accents: 'downbeat' },
  warm: { velocity: 0.92, accents: 'downbeat' },
  // Full weight; the thumb is short so the bass pulses.
  intense: { velocity: 1, accents: 'all', bassMaxDur: TICKS_PER_BEAT / 2 },
  // Crisp: pattern notes are cut to an eighth so the groove bounces.
  upbeat: { velocity: 1, accents: 'all', maxDur: TICKS_PER_BEAT / 2, bassMaxDur: TICKS_PER_BEAT / 2 },
};

/**
 * engine-spec §4 touch: velocity, which accents stay, and how long pattern
 * notes last, by mood. The tune keeps its own length and weight.
 */
export function applyTouch(events: NoteEvent[], mood: MoodLabel, beatsPerBar: BeatsPerBar): void {
  const t = TOUCH[mood];
  const bar = beatsPerBar * TICKS_PER_BEAT;
  for (const e of events) {
    if (e.melody) continue;
    e.velocity = Math.min(1, Math.round(e.velocity * t.velocity * 100) / 100);
    if (e.accent && t.accents === 'downbeat' && e.tick % bar !== 0) delete e.accent;
    if (e.fret < 0) continue;
    const max = e.finger === 'p' ? t.bassMaxDur : t.maxDur;
    if (max !== undefined) e.dur = Math.min(e.dur, max);
  }
}

/** Bars per phrase when reading the song's loudness: sections move in phrases, not bars. */
const PHRASE_BARS = 4;
/** Below this spread between the quiet and loud thirds of the song, it doesn't build: all normal. */
const MIN_CONTRAST = 0.12;

/**
 * engine-spec §4 sections: each bar's loudness (mean of its beats), averaged
 * over 4-bar phrases, then split at the song's thirds: the quiet third is soft
 * (if under 0.6 of the loudest), the loud third full (if over 0.75), the rest
 * normal. A song without that much contrast stays normal throughout.
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
  const low = sorted[Math.floor((sorted.length - 1) / 3)];
  const high = sorted[Math.floor(((sorted.length - 1) * 2) / 3)];
  if (high - low < MIN_CONTRAST) return phrase.map(() => 'normal');
  return phrase.map((p) => (p <= low && p < 0.6 ? 'soft' : p >= high && p > 0.75 ? 'full' : 'normal'));
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
