import { TICKS_PER_BEAT } from './constants.js';
import { type ChordSpan, isPlayable } from './runner.js';
import type { AnalysisResult, Finger, Level, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string, string 0 = low E (shape space: capo removed). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
/** The tune lives on the top four strings, so the thumb keeps the bass strings. */
const MELODY_STRINGS = [5, 4, 3, 2] as const;
const MAX_FRET = 12;
/** Where the tune's middle sits, in shape space: G above middle C, the top strings' sweet spot. */
const TARGET_MEDIAN = 67;
/** Lowest and highest notes the tune may use, in shape space (open D string to the 12th fret of the e string). */
const LOWEST = 55;
const HIGHEST = 76;
const SIXTEENTH = TICKS_PER_BEAT / 4;
/** A note never rings longer than a beat and a half: the tune breathes. */
const MAX_DUR = (TICKS_PER_BEAT * 3) / 2;
const MELODY_VELOCITY = 0.9;
/** Octave choice per note (placeOctaves): a note out of range, a note moved off the song's octave, and an octave change inside a phrase or across a rest. */
const OUT_OF_RANGE_COST = 10;
const OFF_SONG_OCTAVE_COST = 0.1;
const OCTAVE_CHANGE_REVERSES = 3;
const OCTAVE_CHANGE_KEEPS_DIRECTION = 1;
const OCTAVE_CHANGE_AT_REST = 0.5;
/** Pattern notes this close under a sounding melody note (semitones) would mask it. */
const MASK_BELOW = 2;

export type MelodyLineNote = { tick: number; dur: number; midi: number };

/**
 * Seconds into the recording → arrangement ticks, through the beat grid (tempo
 * drift included), extrapolating at the first and last beat's interval.
 */
export function secToTick(beatTimesSec: readonly number[], barStartBeat: number): (sec: number) => number {
  const bt = beatTimesSec;
  const n = bt.length;
  return (sec) => {
    if (n < 2) return 0;
    let beat: number;
    if (sec <= bt[0]) beat = (sec - bt[0]) / (bt[1] - bt[0]);
    else if (sec >= bt[n - 1]) beat = n - 1 + (sec - bt[n - 1]) / (bt[n - 1] - bt[n - 2]);
    else {
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (bt[mid] <= sec) lo = mid;
        else hi = mid;
      }
      beat = lo + (sec - bt[lo]) / (bt[lo + 1] - bt[lo]);
    }
    return (beat - barStartBeat) * TICKS_PER_BEAT;
  };
}

/**
 * engine-spec §4 melody: the tune on the arrangement's grid. Moderate and
 * Advanced: onsets on the nearest 16th (or `grid`, from the fullness), one
 * note per slot (the longer wins). Basic: one note per beat, the one sounding on the beat (or starting just
 * after it). Each note lasts until the next, up to a beat and a half. Pitch
 * stays as sung.
 */
export function quantiseMelody(
  input: Pick<AnalysisResult, 'melody' | 'beatTimesSec' | 'barStartBeat'>,
  level: Level,
  songEnd: number,
  grid: 'beat' | number = level === 'basic' ? 'beat' : SIXTEENTH,
): MelodyLineNote[] {
  const toTick = secToTick(input.beatTimesSec, input.barStartBeat);
  const raw = (input.melody ?? [])
    .map((n) => {
      const tick = toTick(n.startSec);
      return { tick, end: toTick(n.startSec + n.durSec), midi: Math.round(n.midi) };
    })
    .filter((n) => n.tick >= -SIXTEENTH / 2 && n.tick < songEnd);

  const slots = new Map<number, { tick: number; end: number; midi: number }>();
  if (grid === 'beat') {
    for (let beat = 0; beat < songEnd; beat += TICKS_PER_BEAT) {
      const sounding = raw.find((n) => n.tick <= beat + SIXTEENTH / 2 && n.end > beat) ?? raw.find((n) => n.tick > beat && n.tick < beat + SIXTEENTH * 1.5);
      if (sounding) slots.set(beat, { ...sounding, tick: beat });
    }
  } else {
    for (const n of raw) {
      const tick = Math.max(0, Math.round(n.tick / grid) * grid);
      const prev = slots.get(tick);
      if (!prev || n.end - n.tick > prev.end - prev.tick) slots.set(tick, { ...n, tick });
    }
  }
  const line = [...slots.values()].sort((a, b) => a.tick - b.tick);
  // Basic: a beat that repeats the note still sounding ties over.
  const tied = grid === 'beat' ? line.filter((n, i) => !(i > 0 && line[i - 1].midi === n.midi && line[i - 1].end >= n.tick)) : line;
  return tied.map((n, i) => {
    const next = tied[i + 1]?.tick ?? songEnd;
    const sung = Math.max(SIXTEENTH, Math.round((n.end - n.tick) / SIXTEENTH) * SIXTEENTH + SIXTEENTH);
    return { tick: n.tick, dur: Math.max(SIXTEENTH, Math.min(next - n.tick, sung, MAX_DUR)), midi: n.midi };
  });
}

/** The octave shift (in semitones, a multiple of 12) that puts the tune's median nearest the top strings' sweet spot. */
export function melodyShift(line: readonly MelodyLineNote[], capo: number): number {
  if (!line.length) return 0;
  const sorted = line.map((n) => n.midi - capo).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return 12 * Math.round((TARGET_MEDIAN - median) / 12);
}

/**
 * Where a single line note goes (the tune, a fill): strings 2–5, as near the
 * chord shape's hand position as it can be (one fret of stretch is free),
 * preferring the shape's own note, higher strings, and small moves from the
 * previous note, on a string not in `avoid` (taken by the thumb, say).
 */
export function placeNear(midi: number, span: ChordSpan, prev?: { fret: number }, avoid: ReadonlySet<number> = new Set()): { string: number; fret: number } | undefined {
  const fretted = span.voicing.frets.filter((f) => f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const hi = fretted.length ? Math.max(...fretted) : 3;
  let best: { string: number; fret: number; cost: number } | undefined;
  for (const string of MELODY_STRINGS) {
    const fret = midi - OPEN_MIDI[string];
    if (fret < 0 || fret > MAX_FRET || avoid.has(string)) continue;
    let cost = (5 - string) * 0.5;
    if (fret > 0) cost += 3 * Math.max(0, lo - 1 - fret, fret - hi - 1);
    if (span.voicing.frets[string] === fret) cost -= 1;
    if (prev && prev.fret > 0 && fret > 0) cost += 0.3 * Math.abs(fret - prev.fret);
    if (!best || cost < best.cost) best = { string, fret, cost };
  }
  return best && { string: best.string, fret: best.fret };
}

/**
 * engine-spec §4 melody octaves: each note's pitch in shape space, moved by
 * whole octaves. The song's shift (melodyShift) is the default, but a phrase
 * that climbs out of the top strings' range moves an octave as a whole, so its
 * shape survives (a leap up stays a leap up). A best path over the notes: a note
 * out of range costs 10, a note off the song's octave 0.1, changing octave
 * between two notes 3 when it turns the step's direction round (a leap up
 * played going down), 1 when it doesn't, 0.5 between phrases (after a rest of
 * a beat or more, or a note held two beats).
 * Notes still out of range then move an octave in on their own.
 */
export function placeOctaves(line: readonly MelodyLineNote[], capo: number): number[] {
  if (!line.length) return [];
  const shift = melodyShift(line, capo);
  const OFFSETS = [-24, -12, 0, 12, 24];
  const base = line.map((n) => n.midi - capo + shift);
  const noteCost = (midi: number, offset: number) =>
    (midi + offset < LOWEST || midi + offset > HIGHEST ? OUT_OF_RANGE_COST : 0) + (offset ? OFF_SONG_OCTAVE_COST * Math.abs(offset / 12) : 0);
  let cost = OFFSETS.map((o) => noteCost(base[0], o));
  const back: number[][] = [];
  for (let i = 1; i < line.length; i++) {
    // A rest of a beat, or a note held two beats, ends a phrase.
    const rest = line[i].tick - (line[i - 1].tick + line[i - 1].dur) >= TICKS_PER_BEAT || line[i - 1].dur >= 2 * TICKS_PER_BEAT;
    const step = Math.sign(base[i] - base[i - 1]);
    const change = (j: number, k: number) => {
      if (j === k) return 0;
      if (rest) return OCTAVE_CHANGE_AT_REST;
      const placed = Math.sign(base[i] + OFFSETS[k] - (base[i - 1] + OFFSETS[j]));
      return placed === step ? OCTAVE_CHANGE_KEEPS_DIRECTION : OCTAVE_CHANGE_REVERSES;
    };
    const from: number[] = [];
    cost = OFFSETS.map((o, k) => {
      let best = 0;
      let bestCost = Infinity;
      cost.forEach((c, j) => {
        const total = c + change(j, k);
        if (total < bestCost) [best, bestCost] = [j, total];
      });
      from.push(best);
      return bestCost + noteCost(base[i], o);
    });
    back.push(from);
  }
  let state = cost.indexOf(Math.min(...cost));
  const out = new Array<number>(line.length);
  for (let i = line.length - 1; i >= 0; i--) {
    let midi = base[i] + OFFSETS[state];
    while (midi < LOWEST) midi += 12;
    while (midi > HIGHEST) midi -= 12;
    out[i] = midi;
    if (i > 0) state = back[i - 1][state];
  }
  return out;
}

const spanAt = (spans: readonly ChordSpan[], tick: number) => {
  let found: ChordSpan | undefined;
  for (const s of spans) {
    if (s.start > tick) break;
    if (tick < s.end) found = s;
  }
  return found ?? spans.find((s) => s.start >= tick) ?? spans.at(-1);
};

/**
 * engine-spec §4 melody placement: each note of the tune on strings 2–5, as
 * near the chord shape's hand position as it can be (one fret of stretch is
 * free), preferring the shape's own note, higher strings, and small moves
 * from the last melody note. Octaves come from placeOctaves: a phrase that
 * climbs out of range moves an octave as a whole.
 * Moderate and Advanced slur a step of one or two frets on the same string
 * (hammer-on up, pull-off down).
 */
export function placeMelody(line: readonly MelodyLineNote[], spans: readonly ChordSpan[], capo: number, level: Level): NoteEvent[] {
  if (!spans.length) return [];
  const pitches = placeOctaves(line, capo);
  const out: NoteEvent[] = [];
  let prev: NoteEvent | undefined;
  let fingerIndex = 0;
  for (const [i, n] of line.entries()) {
    const midi = pitches[i];
    const span = spanAt(spans, n.tick);
    if (!span) continue;
    const best = placeNear(midi, span, prev);
    if (!best) continue;
    const finger: Finger = best.string === 2 ? 'i' : (['a', 'm'] as const)[fingerIndex++ % 2];
    const note: NoteEvent = { tick: n.tick, dur: n.dur, string: best.string, fret: best.fret, finger, velocity: MELODY_VELOCITY, melody: true };
    if (level !== 'basic' && prev && prev.string === note.string && prev.tick + prev.dur >= note.tick && note.tick - prev.tick <= TICKS_PER_BEAT) {
      const step = note.fret - prev.fret;
      if (prev.fret >= 0 && Math.abs(step) >= 1 && Math.abs(step) <= 2) note.tech = step > 0 ? 'hammer' : 'pull';
    }
    out.push(note);
    prev = note;
  }
  return out;
}

const midiOf = (n: NoteEvent) => OPEN_MIDI[n.string] + n.fret;

/**
 * engine-spec §4 the pattern makes room for the tune: while a melody note
 * sounds, no pattern note on its string, and no finger note at or just under
 * it (the bass stays). Where a melody note and the pattern can't be held
 * together (span or fingers, §4), the pattern's fretted finger notes go, then
 * its fretted bass; open strings stay.
 */
export function mergeMelody(pattern: readonly NoteEvent[], melody: readonly NoteEvent[], spans: readonly ChordSpan[]): NoteEvent[] {
  const soundingAt = (tick: number) => melody.filter((m) => m.tick <= tick && tick < m.tick + m.dur);
  const kept = pattern.filter((p) => {
    if (p.fret < 0) return true; // golpe, slap, apagado: no pitch
    return !soundingAt(p.tick).some((m) => m.string === p.string || (p.finger !== 'p' && midiOf(p) >= midiOf(m) - MASK_BELOW));
  });

  const drop = new Set<NoteEvent>();
  for (const m of melody) {
    const span = spanAt(spans, m.tick);
    if (!span) continue;
    const during = kept.filter((p) => p.fret >= 0 && p.tick >= m.tick && p.tick < m.tick + m.dur);
    for (const tick of new Set([m.tick, ...during.map((p) => p.tick)])) {
      const at = during.filter((p) => p.tick === tick && !drop.has(p));
      const fixed = (notes: NoteEvent[]) => isPlayable([{ ...m, tick }, ...notes], span.voicing);
      if (fixed(at)) continue;
      // Open strings need no finger: only fretted notes go, the fingers' first, then the thumb's.
      const fingers = at.filter((p) => p.finger !== 'p' && p.fret > 0);
      fingers.forEach((p) => drop.add(p));
      const rest = at.filter((p) => !drop.has(p));
      if (!fixed(rest)) rest.filter((p) => p.fret > 0).forEach((p) => drop.add(p));
    }
  }
  return [...kept.filter((p) => !drop.has(p)), ...melody].sort((a, b) => a.tick - b.tick || a.string - b.string);
}
