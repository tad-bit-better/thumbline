import { altBass, type StringFret } from './bass.js';
import { TICKS_PER_BEAT } from './constants.js';
import type {
  AnalysisResult,
  BeatsPerBar,
  ChordLabel,
  NoteEvent,
  PatternDef,
  PatternEvent,
  Target,
  Voicing,
} from './types.js';
import { chordTones } from './chords.js';
import { fretSpan } from './voicings.js';

/** One chord on the timeline, in absolute ticks, with its shape. */
export type ChordSpan = {
  start: number;
  end: number;
  voicing: Voicing;
  /** The chord the voicing sounds, in shape space. */
  played: ChordLabel;
  /** The song's key in shape space (capo removed), for the scale walker. */
  key?: AnalysisResult['key'];
};

const DEFAULT_VELOCITY = 0.8;
const MAX_SPAN = 4;
const MAX_FINGERS = 4;
/** Highest fret a hammer-on from the open string may land on. */
const MAX_HAMMER_FROM_OPEN = 2;

type Resolver = (target: Target) => StringFret[];

function resolverFor(voicing: Voicing, alt: StringFret | null): Resolver {
  const { frets, rootString } = voicing;
  const at = (s: number): StringFret => ({ string: s, fret: frets[s] });
  const bass = [at(rootString)];
  // Highest three sounded strings above the bass: t1 = highest.
  const treble = frets
    .map((f, s) => ({ f, s }))
    .filter(({ f, s }) => f >= 0 && s > rootString)
    .map(({ s }) => at(s))
    .reverse();
  const T4 = 2;

  return (target) => {
    switch (target) {
      case 'bass':
        return bass;
      case 'altBass':
        return alt ? [alt] : bass;
      case 't1':
        return treble.slice(0, 1);
      case 't2':
        return treble.slice(1, 2);
      case 't3':
        return treble.slice(2, 3);
      case 't4':
        return rootString !== T4 && frets[T4] >= 0 ? [at(T4)] : [];
      case 'all':
        return frets.map((_, s) => at(s)).filter((n) => n.fret >= 0);
      case 'scale':
        // Resolved by the scale walker in runSegment.
        return [];
    }
  };
}

/** Pattern events that fall inside the span, with absolute ticks, in pattern order. */
function eventsInSpan(
  pattern: PatternDef,
  span: ChordSpan,
  beatsPerBar: BeatsPerBar,
): Array<{ tick: number; event: PatternEvent }> {
  const events = pattern.events[beatsPerBar] ?? [];
  const barTicks = beatsPerBar * TICKS_PER_BEAT;
  const origin = pattern.anchor === 'bar' ? Math.floor(span.start / barTicks) * barTicks : span.start;
  const out: Array<{ tick: number; event: PatternEvent }> = [];
  for (let base = origin; base < span.end; base += barTicks) {
    for (const event of events) {
      const tick = base + event.tick;
      if (tick >= span.start && tick < span.end) out.push({ tick, event });
    }
  }
  return out.sort((a, b) => a.tick - b.tick);
}

/**
 * Apply a pattern to one chord span (engine-spec §2 runner rules):
 * a thumb bass on the chord change, muted targets dropped, first event wins
 * per string and tick, and legato only where an earlier note allows it.
 */
export function runSegment(pattern: PatternDef, span: ChordSpan, beatsPerBar: BeatsPerBar): NoteEvent[] {
  const resolve = resolverFor(span.voicing, altBass(span.voicing, span.played));
  let events = eventsInSpan(pattern, span, beatsPerBar);

  // Chord change: the thumb plays the root, never the alternate bass.
  events = events.filter((e) => !(e.tick === span.start && e.event.target === 'altBass'));
  if (!events.some((e) => e.tick === span.start && e.event.target === 'bass')) {
    events.unshift({
      tick: span.start,
      event: { tick: 0, dur: TICKS_PER_BEAT, finger: 'p', target: 'bass' },
    });
  }

  const notes: NoteEvent[] = [];
  const taken = new Set<string>();
  const walk = scaleWalker(span);
  for (const { tick, event } of events) {
    // A golpe is a tap on the top: no pitch, and it doesn't take a string's slot,
    // so it can land with a strum (engine-spec §3: string 0, fret -1).
    if (event.tech === 'golpe') {
      if (taken.has(`${tick}:golpe`)) continue;
      taken.add(`${tick}:golpe`);
      notes.push({ tick, dur: Math.min(event.dur, span.end - tick), string: 0, fret: -1, finger: event.finger, velocity: event.velocity ?? DEFAULT_VELOCITY, tech: 'golpe', ...(event.accent ? { accent: true } : {}) });
      continue;
    }
    const targets = event.target === 'scale' ? walk() : resolve(event.target);
    for (const { string, fret } of targets) {
      const key = `${tick}:${string}`;
      if (taken.has(key)) continue;
      taken.add(key);
      const note: NoteEvent = {
        tick,
        dur: Math.min(event.dur, span.end - tick),
        string,
        fret,
        finger: event.finger,
        velocity: event.velocity ?? DEFAULT_VELOCITY,
      };
      if (event.tech) note.tech = event.tech;
      if (event.accent) note.accent = true;
      if (note.tech === 'hammer' || note.tech === 'pull') applyLegato(note, notes);
      notes.push(note);
    }
  }
  return notes.sort((a, b) => a.tick - b.tick || a.string - b.string);
}

/** Keep a hammer-on/pull-off only if an earlier note on the string (within a beat) allows it. */
function applyLegato(note: NoteEvent, earlier: NoteEvent[]): void {
  let prev: NoteEvent | undefined;
  for (let i = earlier.length - 1; i >= 0; i--) {
    const n = earlier[i];
    if (n.string === note.string && n.tick < note.tick) {
      prev = n;
      break;
    }
  }
  const inReach = prev !== undefined && note.tick - prev.tick <= TICKS_PER_BEAT;
  if (prev && inReach && note.tech === 'hammer') {
    if (prev.fret >= 0 && prev.fret < note.fret) return;
    if (prev.fret === note.fret && note.fret > 0 && note.fret <= MAX_HAMMER_FROM_OPEN) {
      prev.fret = 0;
      return;
    }
  }
  if (prev && inReach && note.tech === 'pull' && prev.fret > note.fret) return;
  delete note.tech;
}

/**
 * engine-spec §4 playability: no simultaneous notes spanning more than four
 * frets or needing more than four fretting fingers (a barre counts as one).
 */
export function isPlayable(notes: readonly NoteEvent[], voicing: Voicing): boolean {
  const byTick = new Map<number, number[]>();
  for (const n of notes) {
    if (n.fret < 0) continue;
    const list = byTick.get(n.tick) ?? [];
    list.push(n.fret);
    byTick.set(n.tick, list);
  }
  const barreFret = voicing.barre ? Math.min(...voicing.frets.filter((f) => f > 0)) : null;
  for (const frets of byTick.values()) {
    if (fretSpan(frets) > MAX_SPAN) return false;
    const fretted = frets.filter((f) => f > 0);
    const fingers =
      barreFret === null
        ? fretted.length
        : fretted.filter((f) => f > barreFret).length + (fretted.includes(barreFret) ? 1 : 0);
    if (fingers > MAX_FINGERS) return false;
  }
  return true;
}

const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
/** Picado stays on the lower four strings, within one hand position. */
const SCALE_STRINGS = [0, 1, 2, 3];
const SCALE_REACH = 3;

/**
 * engine-spec §4 scale walker (picado): notes of the key's scale on strings
 * 0–3 within the shape's hand position, chord tones taking the place of a
 * scale note a semitone away (G# over E in A minor: the flamenco sound).
 * Starts on the chord's root and walks up, turning back at either end.
 * Without a key it uses the chord root's major or minor scale.
 */
export function scaleNotes(span: ChordSpan): StringFret[] {
  const key = span.key ?? { pc: span.played.pc, mode: ['m', 'm7', 'dim'].includes(span.played.quality) ? 'minor' : 'major' };
  const pcs = new Set((key.mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS).map((s) => (key.pc + s) % 12));
  const tones = chordTones(span.played);
  for (const t of tones) {
    if (pcs.has(t)) continue;
    pcs.delete((t + 11) % 12);
    pcs.delete((t + 1) % 12);
    pcs.add(t);
  }
  const fretted = span.voicing.frets.filter((f) => f > 0);
  const low = fretted.length && Math.min(...fretted) > SCALE_REACH ? Math.min(...fretted) : 0;
  const high = low === 0 ? SCALE_REACH : low + SCALE_REACH;
  const byPitch = new Map<number, StringFret>();
  for (const string of SCALE_STRINGS) {
    for (let fret = low; fret <= high; fret++) {
      const midi = OPEN_MIDI[string] + fret;
      if (pcs.has(midi % 12) && !byPitch.has(midi)) byPitch.set(midi, { string, fret });
    }
    // An open string in a high position is still in reach.
    if (low > 0 && pcs.has(OPEN_MIDI[string] % 12) && !byPitch.has(OPEN_MIDI[string])) byPitch.set(OPEN_MIDI[string], { string, fret: 0 });
  }
  return [...byPitch.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

function scaleWalker(span: ChordSpan): () => StringFret[] {
  let notes: StringFret[] | null = null;
  let i = 0;
  let step = 1;
  return () => {
    if (!notes) {
      notes = scaleNotes(span);
      const root = notes.findIndex((n) => (OPEN_MIDI[n.string] + n.fret) % 12 === span.played.pc);
      i = Math.max(0, root);
    }
    if (!notes.length) return [];
    const note = notes[i];
    if (notes.length > 1) {
      if (i + step < 0 || i + step >= notes.length) step = -step;
      i += step;
    }
    return [note];
  };
}
