import { TICKS_PER_BEAT } from './constants.js';
import { type ChordSpan, isPlayable } from './runner.js';
import type { Level, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string (shape space). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
/** The thumb's strings. */
const BASS_STRINGS = [0, 1, 2] as const;
const MAX_FRET = 7;
/** A chord shorter than this keeps its bass: the walk would eat it. */
const MIN_CHORD = 3 * TICKS_PER_BEAT;
const WALK_VELOCITY = 0.7;
const STEPS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const bassOf = (span: ChordSpan) =>
  span.bass ? OPEN_MIDI[span.bass.string] + span.bass.fret : OPEN_MIDI[span.voicing.rootString] + span.voicing.frets[span.voicing.rootString];

/** A bass string and fret for `midi`, nearest the shape's hand position; open strings are free. */
function placeBass(midi: number, span: ChordSpan): { string: number; fret: number } | undefined {
  const fretted = span.voicing.frets.filter((f) => f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const hi = fretted.length ? Math.max(...fretted) : 3;
  let best: { string: number; fret: number; cost: number } | undefined;
  for (const string of BASS_STRINGS) {
    const fret = midi - OPEN_MIDI[string];
    if (fret < 0 || fret > MAX_FRET) continue;
    const cost = fret === 0 ? 0 : Math.max(0, lo - 1 - fret, fret - hi - 1) * 3 + 0.5;
    if (!best || cost < best.cost) best = { string, fret, cost };
  }
  return best && { string: best.string, fret: best.fret };
}

/**
 * engine-spec §4 walking bass (M11): a guitarist's thumb walks into the next
 * chord instead of jumping. Where a chord of three beats or more moves to one
 * whose bass is more than a whole step away, the thumb plays the key's scale
 * notes between them on the way in: Moderate the one next to the new bass on
 * the last beat; Advanced the two next to it as eighths over the last beat.
 * Each goes on a bass string (0–2) near the shape's hand position, replacing
 * the thumb's note (and any note on that string) at that moment, and only if
 * the hand can hold it with the rest. Basic and flamenco keep their bass.
 */
export function walkBass(events: readonly NoteEvent[], spans: readonly ChordSpan[], level: Level): NoteEvent[] {
  if (level === 'basic') return [...events];
  let out = [...events];
  for (let i = 0; i + 1 < spans.length; i++) {
    const cur = spans[i];
    const next = spans[i + 1];
    if (next.start !== cur.end || cur.end - cur.start < MIN_CHORD) continue;
    const from = bassOf(cur);
    const to = bassOf(next);
    if (Math.abs(to - from) <= 2) continue;
    const key = next.key ?? cur.key;
    if (!key) continue;
    const scale = new Set((STEPS[key.mode] ?? STEPS['major']).map((s) => (key.pc + s) % 12));
    const dir = Math.sign(to - from);
    // Scale notes strictly between, in walking order; the ones nearest the new bass are played.
    const between: number[] = [];
    for (let m = from + dir; m !== to; m += dir) if (scale.has(((m % 12) + 12) % 12)) between.push(m);
    const count = level === 'advanced' ? 2 : 1;
    const notes = between.slice(-count);
    if (!notes.length) continue;
    const ticks = notes.length === 2 ? [next.start - TICKS_PER_BEAT, next.start - TICKS_PER_BEAT / 2] : [next.start - TICKS_PER_BEAT];
    notes.forEach((midi, k) => {
      const tick = ticks[k];
      const spot = placeBass(midi, cur);
      if (!spot) return;
      const thumb = out.find((e) => e.tick === tick && e.finger === 'p' && !e.tech?.startsWith('brush'));
      const walk: NoteEvent = {
        tick,
        dur: (ticks[k + 1] ?? next.start) - tick,
        string: spot.string,
        fret: spot.fret,
        finger: 'p',
        velocity: thumb?.velocity ?? WALK_VELOCITY,
        walk: true,
      };
      const others = out.filter((e) => e.tick === tick && e !== thumb && e.string !== walk.string);
      if (!isPlayable([...others, walk], cur.voicing)) return;
      out = out.filter((e) => !(e.tick === tick && (e === thumb || e.string === walk.string)));
      out.push(walk);
    });
  }
  return out.sort((a, b) => a.tick - b.tick || a.string - b.string);
}
