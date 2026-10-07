import { chordTones } from './chords.js';
import { TICKS_PER_BEAT } from './constants.js';
import { type ChordSpan, isPlayable } from './runner.js';
import type { HarmonyRule } from './fullness.js';
import type { BeatsPerBar, Finger, Level, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string (shape space). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
const MAX_FRET = 12;
/** Harmony stays off the two bass strings: they are the thumb's. */
const LOWEST_STRING = 2;
/** Semitones under the tune for the first voice, best first: a third, a sixth, then a fourth. */
const FIRST_VOICE = [3, 4, 8, 9, 5];
/** The second voice (Advanced downbeats) fills in the chord further down. */
const SECOND_VOICE = [7, 8, 9, 10, 12];
/** Harmony sits under the tune: this much of its velocity. */
const HARMONY_VELOCITY = 0.8;
/** The fingers left for harmony under each tune finger. */
const FREE_FINGERS: Record<Finger, Finger[]> = { c: ['a', 'm', 'i'], a: ['m', 'i'], m: ['i'], i: [], p: [] };

const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;

const spanAt = (spans: readonly ChordSpan[], tick: number) => spans.find((s) => s.start <= tick && tick < s.end);

/** How many voices a tune note gets under it under this rule (0 = none). */
function voicesFor(rule: HarmonyRule, tick: number, dur: number, bar: number): number {
  if (rule === 'none') return 0;
  const onBar = tick % bar === 0;
  const onBeat = tick % TICKS_PER_BEAT === 0;
  const eighth = dur >= TICKS_PER_BEAT / 2;
  if (rule === 'moderate') return (onBar && eighth) || (onBeat && dur >= TICKS_PER_BEAT) ? 1 : 0;
  if (onBar && eighth) return 2;
  // Richest: any note on a beat gets two.
  if (rule === 'richest' && onBeat && eighth) return 2;
  if (onBeat && eighth) return 1;
  // Rich and richest: off-beat notes of an eighth or more get one too.
  return rule !== 'advanced' && eighth ? 1 : 0;
}

/**
 * engine-spec §4 harmony (M11): a guitarist harmonises the tune with the
 * chord. Moderate: a tune note on the bar's first beat (an eighth or longer)
 * or on any beat held a beat or more gets one chord tone under it; Advanced:
 * every tune note on a beat (an eighth or longer) gets one, and the bar's first
 * gets two, so the chord sits under the tune. The first voice is a chord tone
 * a third, sixth or fourth below; the second 7–12 semitones below. Both go on
 * strings 2–4 below the tune's string, played by the fingers the tune leaves
 * free (a → m, i; m → i), within the hand's reach with everything else at that
 * moment. A pattern note already sounding such a tone (a roll's, a pinch's)
 * counts, and is marked and held as harmony. The fullness (§4) can ask for
 * more: `rule` rich also harmonises off-beat tune notes of an eighth or more,
 * richest gives every note on a beat (an eighth or longer) two voices. The harmony
 * replaces pattern notes on its string while it rings (stopping short of a
 * thumb note there rather than dropping it), at 0.8 of the tune's
 * velocity, for at most a beat. Basic stays plain.
 */
export function harmonise(
  events: readonly NoteEvent[],
  spans: readonly ChordSpan[],
  level: Level,
  beatsPerBar: BeatsPerBar,
  rule: HarmonyRule = level === 'basic' ? 'none' : level,
): NoteEvent[] {
  if (rule === 'none') return [...events];
  const bar = beatsPerBar * TICKS_PER_BEAT;
  let out = [...events];
  for (const tune of events.filter((e) => e.melody)) {
    const want = voicesFor(rule, tune.tick, tune.dur, bar);
    const span = spanAt(spans, tune.tick);
    if (!want || !span) continue;
    const tones = chordTones(span.played);
    const top = midiOf(tune);
    const at = () => out.filter((e) => e.tick === tune.tick && e !== tune && e.fret >= 0);
    const fits = (e: NoteEvent, below: number, lowest: number) =>
      e.string >= LOWEST_STRING && e.string < tune.string && top - midiOf(e) >= Math.min(...FIRST_VOICE) && top - midiOf(e) <= below && midiOf(e) < lowest && tones.has(midiOf(e) % 12);
    // Pattern notes already harmonising (a roll's or pinch's chord tone under the tune) count.
    let have = at()
      .filter((e) => !e.melody && fits(e, Math.max(...SECOND_VOICE), top))
      .sort((x, y) => midiOf(y) - midiOf(x))
      .slice(0, want);
    // They become the harmony: marked, and ringing with the tune note.
    out = out.map((e) => (have.includes(e) ? { ...e, harmony: true as const, dur: Math.max(e.dur, Math.min(tune.dur, TICKS_PER_BEAT)) } : e));
    have = out.filter((e) => e.harmony && e.tick === tune.tick && e.string < tune.string);
    const fingers = FREE_FINGERS[tune.finger].filter((f) => !have.some((e) => e.finger === f));
    for (let voice = have.length; voice < want && fingers.length; voice++) {
      const lowest = have.length ? Math.min(...have.map(midiOf)) : top;
      const below = have.length ? Math.min(...have.map((e) => e.string)) : tune.string;
      let placed: NoteEvent | undefined;
      for (const interval of voice === 0 ? FIRST_VOICE : SECOND_VOICE) {
        const midi = top - interval;
        if (midi >= lowest || !tones.has(((midi % 12) + 12) % 12)) continue;
        for (let string = below - 1; string >= LOWEST_STRING && !placed; string--) {
          const fret = midi - OPEN_MIDI[string];
          if (fret < 0 || fret > MAX_FRET) continue;
          const candidate: NoteEvent = {
            tick: tune.tick,
            dur: Math.min(tune.dur, TICKS_PER_BEAT),
            string,
            fret,
            finger: fingers[0],
            velocity: Math.round(tune.velocity * HARMONY_VELOCITY * 100) / 100,
            harmony: true,
          };
          const others = at().filter((e) => e.string !== string);
          if (isPlayable([tune, ...others, candidate], span.voicing)) placed = candidate;
        }
        if (placed) break;
      }
      if (!placed) break;
      const h = placed;
      // The harmony replaces the pattern's notes on its string while it rings, but never the thumb's:
      // it stops short of the next thumb note there instead of leaving a hole in the bass.
      const nextThumb = out.find((e) => e.string === h.string && e.finger === 'p' && e.tick > h.tick && e.tick < h.tick + h.dur);
      if (nextThumb) h.dur = nextThumb.tick - h.tick;
      out = out.filter((e) => e.melody || e.string !== h.string || e.tick < h.tick || e.tick >= h.tick + h.dur);
      out.push(h);
      have = [...have, h];
      fingers.shift();
    }
  }
  return out.sort((a, b) => a.tick - b.tick || a.string - b.string);
}
