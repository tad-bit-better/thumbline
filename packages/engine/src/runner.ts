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
  /** The song's own bass note under this chord when the shape has none for it (M11b): the thumb's `bass`. */
  bass?: StringFret;
};

const DEFAULT_VELOCITY = 0.8;
const MAX_SPAN = 4;
const MAX_FINGERS = 4;
/** Highest fret a hammer-on from the open string may land on. */
const MAX_HAMMER_FROM_OPEN = 2;
/** How far an open chord tone hammers up to a scale note. */
const LEGATO_STEP = 2;
/** Techniques with no pitch: one note on string 0, fret -1. */
const PITCHLESS: ReadonlySet<string> = new Set(['golpe', 'slap', 'apagado']);

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
      case 'campanella':
      case 'drone':
      case 'pedal':
        // Resolved in runSegment: they need the key, not just the shape.
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
  const shapeResolve = resolverFor(span.voicing, altBass(span.voicing, span.played));
  // The song's bass, when it has its own (Cm over Ab): the thumb plays it, and nothing sounds under it.
  const songBass = span.bass;
  const resolve: Resolver = songBass
    ? (target) => (target === 'bass' ? [songBass] : shapeResolve(target).map((n) => (n.string < songBass.string || (n.string === songBass.string && target === 'altBass') ? songBass : n)))
    : shapeResolve;
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
  const walk = scaleWalker(span, scaleNotes);
  const bells = scaleWalker(span, campanellaNotes);
  for (const { tick, event } of events) {
    // Golpe, slap and apagado have no pitch and don't take a string's slot,
    // so they can land with a strum or a bass note (engine-spec §3: string 0, fret -1).
    if (event.tech && PITCHLESS.has(event.tech)) {
      if (taken.has(`${tick}:${event.tech}`)) continue;
      taken.add(`${tick}:${event.tech}`);
      notes.push({ tick, dur: Math.min(event.dur, span.end - tick), string: 0, fret: -1, finger: event.finger, velocity: event.velocity ?? DEFAULT_VELOCITY, tech: event.tech, ...(event.accent ? { accent: true } : {}) });
      continue;
    }
    const targets =
      event.target === 'scale'
        ? walk()
        : event.target === 'campanella'
          ? bells()
          : event.target === 'drone'
            ? drone(span, resolve)
            : event.target === 'pedal'
              ? pedal(span, resolve)
              : resolve(event.target);
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
      if (note.tech === 'hammer' || note.tech === 'pull') applyLegato(note, notes, span);
      if (note.tech === 'harmonic') applyHarmonic(note, span);
      notes.push(note);
    }
  }
  // A natural harmonic needs the fretting hand off the strings at that moment.
  for (const n of notes) {
    if (n.tech !== 'harmonic') continue;
    if (notes.some((o) => o !== n && o.tick === n.tick && o.fret > 0 && o.tech !== 'harmonic')) {
      n.fret = span.voicing.frets[n.string];
      delete n.tech;
    }
  }
  return notes.sort((a, b) => a.tick - b.tick || a.string - b.string);
}

/**
 * Keep a hammer-on/pull-off only where the left hand can play it (engine-spec §2):
 * an earlier note on the string within a beat, lower for a hammer-on and higher
 * for a pull-off. When the earlier note sits on the same fret the runner moves
 * one end: a hammer-on starts from the barre or the open string; a pull-off
 * lands on them; and an open chord tone may hammer up to a scale note two frets
 * higher if a free finger can reach it.
 */
function applyLegato(note: NoteEvent, earlier: NoteEvent[], span: ChordSpan): void {
  let prev: NoteEvent | undefined;
  for (let i = earlier.length - 1; i >= 0; i--) {
    const n = earlier[i];
    if (n.string === note.string && n.tick < note.tick) {
      prev = n;
      break;
    }
  }
  if (!prev || prev.fret < 0 || prev.tech === 'harmonic' || note.tick - prev.tick > TICKS_PER_BEAT) {
    delete note.tech;
    return;
  }
  const { frets, barre } = span.voicing;
  const barreFret = barre ? Math.min(...frets.filter((f) => f > 0)) : null;
  // Where the string rests with its finger lifted: the barre, else open.
  const rest = barreFret ?? 0;
  const restOk = barreFret !== null || note.fret <= MAX_HAMMER_FROM_OPEN;

  if (note.tech === 'hammer') {
    if (prev.fret < note.fret) return;
    if (prev.fret === note.fret && note.fret > rest && restOk) {
      prev.fret = rest;
      return;
    }
    if (prev.fret === note.fret && note.fret === 0 && barreFret === null) {
      const up = LEGATO_STEP;
      const pc = (OPEN_MIDI[note.string] + up) % 12;
      const reach = frets.map((f, s) => (s === note.string ? up : f));
      if (scalePcs(span).has(pc) && fretSpan(reach) < MAX_SPAN && reach.filter((f) => f > 0).length <= MAX_FINGERS) {
        note.fret = up;
        return;
      }
    }
  }
  if (note.tech === 'pull') {
    if (prev.fret > note.fret) return;
    const pc = (OPEN_MIDI[note.string] + rest) % 12;
    if (prev.fret === note.fret && note.fret > rest && restOk && (barreFret !== null || scalePcs(span).has(pc))) {
      note.fret = rest;
      return;
    }
  }
  delete note.tech;
}

/** Fret positions of the natural harmonics, by preference, and the interval each sounds above the open string. */
const HARMONIC_NODES = [
  { fret: 12, interval: 0 },
  { fret: 7, interval: 7 },
] as const;

/** A natural harmonic on the note's string that sounds a chord tone, else a plain note. */
function applyHarmonic(note: NoteEvent, span: ChordSpan): void {
  const tones = chordTones(span.played);
  const node = HARMONIC_NODES.find(({ interval }) => tones.has((OPEN_MIDI[note.string] + interval) % 12));
  if (node) note.fret = node.fret;
  else delete note.tech;
}

/** The key's scale with chord tones in place of a neighbour a semitone away (shape space). */
function scalePcs(span: ChordSpan): Set<number> {
  const key = span.key ?? { pc: span.played.pc, mode: ['m', 'm7', 'dim'].includes(span.played.quality) ? 'minor' : 'major' };
  const pcs = new Set((key.mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS).map((s) => (key.pc + s) % 12));
  for (const t of chordTones(span.played)) {
    if (pcs.has(t)) continue;
    pcs.delete((t + 11) % 12);
    pcs.delete((t + 1) % 12);
    pcs.add(t);
  }
  return pcs;
}

/**
 * engine-spec §4 playability: no simultaneous notes spanning more than four
 * frets or needing more than four fretting fingers (a barre counts as one).
 */
export function isPlayable(notes: readonly NoteEvent[], voicing: Voicing): boolean {
  const byTick = new Map<number, number[]>();
  for (const n of notes) {
    if (n.fret < 0 || n.tech === 'harmonic') continue;
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
  const pcs = scalePcs(span);
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

function scaleWalker(span: ChordSpan, source: (span: ChordSpan) => StringFret[]): () => StringFret[] {
  let notes: StringFret[] | null = null;
  let i = 0;
  let step = 1;
  return () => {
    if (!notes) {
      notes = source(span);
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

/** Campanella stays on the top four strings so the bells sit above the bass. */
const CAMPANELLA_STRINGS = [2, 3, 4, 5];

/**
 * engine-spec §4 campanella: the key's scale (as for picado) on strings 2–5,
 * within the shape's hand position stretched by a fret (to fret 5 in first
 * position) plus open strings. Each note goes on a different string from the
 * one before when it can, preferring an open string, then the higher string,
 * so neighbouring notes ring into each other like bells (B open, then C on the
 * G string). Ascending; the walker turns back at either end.
 */
export function campanellaNotes(span: ChordSpan): StringFret[] {
  const pcs = scalePcs(span);
  const fretted = span.voicing.frets.filter((f) => f > 0);
  const low = fretted.length && Math.min(...fretted) > SCALE_REACH ? Math.min(...fretted) : 0;
  const high = low === 0 ? SCALE_REACH + 2 : low + SCALE_REACH + 1;
  const byPitch = new Map<number, StringFret[]>();
  for (const string of CAMPANELLA_STRINGS) {
    for (const fret of [0, ...Array.from({ length: high - Math.max(1, low) + 1 }, (_, i) => Math.max(1, low) + i)]) {
      const midi = OPEN_MIDI[string] + fret;
      if (!pcs.has(midi % 12)) continue;
      byPitch.set(midi, [...(byPitch.get(midi) ?? []), { string, fret }]);
    }
  }
  const out: StringFret[] = [];
  for (const midi of [...byPitch.keys()].sort((a, b) => a - b)) {
    const prev = out.at(-1);
    // A different string from the last note, open if possible, else the higher string (lower fret).
    const pick = [...(byPitch.get(midi) ?? [])].sort(
      (a, b) =>
        Number(a.string === prev?.string) - Number(b.string === prev?.string) ||
        Number(a.fret !== 0) - Number(b.fret !== 0) ||
        b.string - a.string,
    )[0];
    out.push(pick);
  }
  return out;
}

/** An open string can ring when no barre covers it; a single finger can lift off it. */
const canRingOpen = (voicing: Voicing, string: number) => !voicing.barre || voicing.frets[string] <= 0;

/**
 * engine-spec §4 drone: the open 1st string, else the open 2nd, when its note is
 * in the key, ringing whatever the chord; otherwise the shape's top note.
 */
function drone(span: ChordSpan, resolve: Resolver): StringFret[] {
  const pcs = scalePcs(span);
  for (const string of [5, 4]) {
    if (pcs.has(OPEN_MIDI[string] % 12) && canRingOpen(span.voicing, string)) return [{ string, fret: 0 }];
  }
  return resolve('t1');
}

/**
 * engine-spec §4 pedal: the key's tonic, else its fifth, on an open bass string
 * (E, A or D), held under every chord; otherwise the chord's bass.
 */
function pedal(span: ChordSpan, resolve: Resolver): StringFret[] {
  const key = span.key ?? { pc: span.played.pc };
  for (const pc of [key.pc, (key.pc + 7) % 12]) {
    const string = [0, 1, 2].find((s) => OPEN_MIDI[s] % 12 === pc && canRingOpen(span.voicing, s));
    if (string !== undefined) return [{ string, fret: 0 }];
  }
  return resolve('bass');
}
