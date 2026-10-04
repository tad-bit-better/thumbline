import { altBass, type StringFret } from './bass.js';
import { TICKS_PER_BEAT } from './constants.js';
import type {
  BeatsPerBar,
  ChordLabel,
  NoteEvent,
  PatternDef,
  PatternEvent,
  Target,
  Voicing,
} from './types.js';
import { fretSpan } from './voicings.js';

/** One chord on the timeline, in absolute ticks, with its shape. */
export type ChordSpan = {
  start: number;
  end: number;
  voicing: Voicing;
  /** The chord the voicing sounds, in shape space. */
  played: ChordLabel;
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
        // The scale walker arrives with flamenco picado (M7).
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
  for (const { tick, event } of events) {
    for (const { string, fret } of resolve(event.target)) {
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
