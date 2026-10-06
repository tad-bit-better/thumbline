import { TICKS_PER_BEAT } from './constants.js';
import { placeNear } from './melody.js';
import { type ChordSpan, isPlayable } from './runner.js';
import { type FillRhythm, fullnessRules } from './fullness.js';
import type { Finger, Level, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string (shape space). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
/** Fills stay in the tune's range on the top strings. */
const LOWEST = 55;
const HIGHEST = 76;
const FILL_VELOCITY = 0.7;
const FINGERS: Finger[] = ['i', 'm'];
const STEPS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;
const spanAt = (spans: readonly ChordSpan[], tick: number) => spans.find((s) => s.start <= tick && tick < s.end);

/** The `count` scale notes leading into `target` from below (ascending) or above (descending). */
function approach(target: number, count: number, fromBelow: boolean, scale: Set<number>): number[] {
  const out: number[] = [];
  for (let m = target + (fromBelow ? -1 : 1); out.length < count && Math.abs(m - target) < 24; m += fromBelow ? -1 : 1) {
    if (scale.has(((m % 12) + 12) % 12)) out.push(m);
  }
  return out.reverse();
}

/**
 * engine-spec §4 fills (M11): where the tune rests for a beat or more between
 * two of its notes, a guitarist plays a short run into the next one instead of
 * letting the pattern repeat. Moderate: two eighths in the last beat before
 * the next tune note; Advanced: two eighths then four sixteenths over the last
 * two beats (four sixteenths when only one beat is free). The notes walk the
 * key's scale into the next tune note, from below when the tune rises (or
 * repeats), from above when it falls; notes outside the tune's range (D string
 * open to the 12th fret of the e string) drop from the run's start, and the
 * other side is taken only if it keeps more notes and the preferred side lost
 * more than one. Placed like the tune near
 * the hand, fingers i and m alternating, a step of one or two frets on the same
 * string a sixteenth apart slurred (Advanced). The pattern's finger notes in
 * the window give way; the thumb's bass stays, and a fill note that the hand
 * can't hold with it is left out. Basic and flamenco play no fills. The
 * fullness (§4) sets how long the rest must be and the rhythms (`rules`; by
 * default the level's own, as above): the longest rhythm that fits the rest.
 */
export function addFills(
  events: readonly NoteEvent[],
  spans: readonly ChordSpan[],
  level: Level,
  rules: { rest: number | null; rhythms: readonly FillRhythm[]; trim?: boolean } = (({ fillRest, fillRhythms }) => ({ rest: fillRest, rhythms: fillRhythms }))(fullnessRules(5, level)),
): NoteEvent[] {
  if (rules.rest === null || !rules.rhythms.length) return [...events];
  const minRest = rules.rest;
  const tune = events.filter((e) => e.melody).sort((a, b) => a.tick - b.tick);
  let out = [...events];
  for (let i = 1; i < tune.length; i++) {
    const last = tune[i - 1];
    const next = tune[i];
    const restFrom = last.tick + last.dur;
    const rest = next.tick - restFrom;
    if (rest < minRest) continue;
    let rhythm = rules.rhythms.find((r) => r.span <= rest);
    if (rules.trim && rhythm !== rules.rhythms[0]) {
      // The longest run's tail, from the first eighth inside the rest.
      const longest = rules.rhythms[0];
      const room = Math.floor(rest / (TICKS_PER_BEAT / 2)) * (TICKS_PER_BEAT / 2);
      const tail = { span: room, at: longest.at.filter((t) => t >= longest.span - room).map((t) => t - (longest.span - room)) };
      if (tail.at.length > (rhythm?.at.length ?? 0)) rhythm = tail;
    }
    if (!rhythm) continue;
    const from = next.tick - rhythm.span;
    const span = spanAt(spans, from);
    if (!span?.key) continue;
    const key = span.key;
    const scale = new Set((STEPS[key.mode] ?? STEPS['major']).map((s) => (key.pc + s) % 12));
    const target = midiOf(next);
    // The run's notes nearest the target that stay in range; the preferred side wins unless it loses more than one.
    const inRange = (fromBelow: boolean) => {
      const run = approach(target, rhythm.at.length, fromBelow, scale);
      let k = run.length;
      while (k > 0 && run[k - 1] >= LOWEST && run[k - 1] <= HIGHEST) k--;
      return run.slice(k);
    };
    const preferred = inRange(midiOf(last) <= target);
    const other = inRange(midiOf(last) > target);
    const line = preferred.length >= rhythm.at.length - 1 || preferred.length >= other.length ? preferred : other;
    if (!line.length) continue;
    // A shorter run starts later: it keeps the rhythm's last slots.
    const slots = rhythm.at.slice(rhythm.at.length - line.length);

    // The pattern's finger notes in the window give way; the thumb keeps going.
    out = out.filter((e) => e.melody || e.harmony || e.finger === 'p' || e.tick < from || e.tick >= next.tick);
    let prev: NoteEvent | undefined = last;
    slots.forEach((offset, k) => {
      const tick = from + offset;
      const spanHere = spanAt(spans, tick) ?? span;
      const thumb = new Set(out.filter((e) => e.tick === tick && e.finger === 'p').map((e) => e.string));
      const spot = placeNear(line[k], spanHere, prev, thumb);
      if (!spot) return;
      const dur = (slots[k + 1] ?? rhythm.span) - offset;
      const note: NoteEvent = { tick, dur, string: spot.string, fret: spot.fret, finger: FINGERS[k % 2], velocity: FILL_VELOCITY, fill: true };
      const atTick = out.filter((e) => e.tick === tick && e.string !== note.string);
      if (!isPlayable([...atTick, note], spanHere.voicing)) return;
      if (level === 'advanced' && prev?.fill && prev.string === note.string && tick - prev.tick <= TICKS_PER_BEAT / 4 && prev.fret >= 0) {
        const step = note.fret - prev.fret;
        if (Math.abs(step) >= 1 && Math.abs(step) <= 2) note.tech = step > 0 ? 'hammer' : 'pull';
      }
      out = out.filter((e) => !(e.tick === tick && e.string === note.string));
      out.push(note);
      prev = note;
    });
  }
  return out.sort((a, b) => a.tick - b.tick || a.string - b.string);
}
