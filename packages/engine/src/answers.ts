import { chordTones } from './chords.js';
import { TICKS_PER_BEAT } from './constants.js';
import { placeNear } from './melody.js';
import { type ChordSpan, isPlayable } from './runner.js';
import type { Finger, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string (shape space). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
const SIXTEENTH = TICKS_PER_BEAT / 4;
/** The tune must pause this long for an echo. */
const ECHO_MIN_REST = 2 * TICKS_PER_BEAT;
/** Notes of the phrase's end an echo repeats, at most and at least. */
const ECHO_MAX_NOTES = 4;
const ECHO_MIN_NOTES = 2;
/** Notes closer than this belong to one phrase. */
const PHRASE_GAP = TICKS_PER_BEAT;
/** The echo leaves this much quiet before the tune comes back. */
const ECHO_BREATH = TICKS_PER_BEAT / 2;
/** Echoes stay where the tune is placed on the guitar (shape space). */
const LOWEST = 55;
const HIGHEST = 76;
const ECHO_VELOCITY = 0.62;
/** A tune note held this long gets a counter-line under it (the tune's notes are capped at this, so it breathes). */
const HELD = (3 * TICKS_PER_BEAT) / 2;
/** The counter-line runs on through the quiet after the note, up to this long from its start. */
const COUNTER_SPAN = 3 * TICKS_PER_BEAT;
/** The counter-line sits at least this far under the tune (semitones), and at most this far. */
const COUNTER_BELOW_MIN = 3;
const COUNTER_BELOW_MAX = 15;
const COUNTER_VELOCITY = 0.7;
const FINGERS: Finger[] = ['i', 'm'];
const STEPS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const midiOf = (e: Pick<NoteEvent, 'string' | 'fret'>) => OPEN_MIDI[e.string] + e.fret;
const spanAt = (spans: readonly ChordSpan[], tick: number) => spans.find((s) => s.start <= tick && tick < s.end);

/** `midi` moved `steps` scale degrees down (negative steps go up), in the key's scale. */
function diatonicDown(midi: number, steps: number, scale: ReadonlySet<number>): number {
  let m = midi;
  for (let k = 0; k < Math.abs(steps); ) {
    m += steps > 0 ? -1 : 1;
    if (scale.has(((m % 12) + 12) % 12)) k++;
  }
  return m;
}

/** Put `note` in, taking its string from the pattern's finger notes while it sounds; the thumb, tune and harmony stay. */
function place(out: NoteEvent[], note: NoteEvent): NoteEvent[] {
  const end = note.tick + note.dur;
  return [
    ...out.filter((e) => e.melody || e.harmony || e.fill || e.finger === 'p' || e.string !== note.string || e.tick < note.tick || e.tick >= end),
    note,
  ];
}

/**
 * engine-spec §4 echoes (fullness 9–10, Moderate and Advanced): where the tune
 * pauses two beats or more, the guitar answers with the end of the phrase it
 * just heard: its last 2–4 notes (a phrase's notes are less than a beat apart),
 * in their own rhythm, from the first eighth after the tune stops, ending at
 * least half a beat before it comes back (notes drop from the front to fit; the
 * last may be cut short). An octave down, else a third down in the key, else a
 * third up, else as sung: the first that stays on the top strings (MIDI 55–76,
 * shape space); placed near the hand like a fill, as `fill` notes at 0.62, all
 * of them or none. An echo
 * replaces the run in its pause. `wants(tick)`: whether the bar of the pause asks for echoes.
 */
export function addEchoes(events: readonly NoteEvent[], spans: readonly ChordSpan[], wants: (tick: number) => boolean): NoteEvent[] {
  const tune = events.filter((e) => e.melody).sort((a, b) => a.tick - b.tick);
  let out = [...events];
  for (let i = 1; i < tune.length; i++) {
    const last = tune[i - 1];
    const next = tune[i];
    const restFrom = last.tick + last.dur;
    if (next.tick - restFrom < ECHO_MIN_REST || !wants(restFrom)) continue;
    // The phrase's end: notes before the pause, each less than a beat after the one before.
    let first = i - 1;
    while (first > 0 && i - first < ECHO_MAX_NOTES && tune[first].tick - (tune[first - 1].tick + tune[first - 1].dur) < PHRASE_GAP) first--;
    let tail = tune.slice(first, i);
    const start = Math.ceil(restFrom / (TICKS_PER_BEAT / 2)) * (TICKS_PER_BEAT / 2);
    const room = next.tick - ECHO_BREATH - start;
    // From the first onset to an eighth after the last: the last note may be cut short to fit.
    const length = (t: NoteEvent[]) => t[t.length - 1].tick - t[0].tick + TICKS_PER_BEAT / 2;
    while (tail.length > ECHO_MIN_NOTES && length(tail) > room) tail = tail.slice(1);
    if (tail.length < ECHO_MIN_NOTES || length(tail) > room) continue;
    const span = spanAt(spans, start);
    if (!span?.key) continue;
    const scale = new Set((STEPS[span.key.mode] ?? STEPS['major']).map((s) => (span.key!.pc + s) % 12));
    const pitches = tail.map(midiOf);
    // An octave down, else a third down, else a third up, else as sung: the first that stays on the top strings.
    const inRange = (ms: number[]) => ms.every((m) => m >= LOWEST && m <= HIGHEST);
    const shifted =
      [pitches.map((m) => m - 12), pitches.map((m) => diatonicDown(m, 2, scale)), pitches.map((m) => diatonicDown(m, -2, scale))].find(inRange) ?? pitches;
    // The echo replaces the run in this pause.
    let echoed = out.filter((e) => !(e.fill && e.tick >= restFrom && e.tick < next.tick));
    const notes: NoteEvent[] = [];
    let prev: Pick<NoteEvent, 'fret'> | undefined;
    let ok = true;
    tail.forEach((t, k) => {
      if (!ok) return;
      const tick = start + Math.round((t.tick - tail[0].tick) / SIXTEENTH) * SIXTEENTH;
      const end = k + 1 < tail.length ? start + Math.round((tail[k + 1].tick - tail[0].tick) / SIXTEENTH) * SIXTEENTH : Math.min(tick + Math.min(t.dur, TICKS_PER_BEAT), next.tick - ECHO_BREATH);
      const here = spanAt(spans, tick) ?? span;
      const thumb = new Set(echoed.filter((e) => e.tick === tick && e.finger === 'p').map((e) => e.string));
      const spot = placeNear(shifted[k], here, prev, thumb);
      if (!spot || end <= tick) return void (ok = false);
      const note: NoteEvent = { tick, dur: end - tick, string: spot.string, fret: spot.fret, finger: FINGERS[k % 2], velocity: ECHO_VELOCITY, fill: true };
      const atTick = echoed.filter((e) => e.tick === tick && e.string !== note.string && (e.melody || e.harmony || e.finger === 'p'));
      if (!isPlayable([...atTick, note], here.voicing)) return void (ok = false);
      notes.push(note);
      prev = note;
    });
    // All of it or none: half an echo isn't an answer.
    if (!ok || notes.length !== tail.length) continue;
    for (const n of notes) echoed = place(echoed, n);
    out = echoed;
  }
  return out.sort((a, b) => a.tick - b.tick || a.string - b.string);
}

/**
 * engine-spec §4 counter-line (fullness 9–10, Advanced): under a tune note held
 * a beat and a half or more, an inner voice moves a beat at a time against the
 * tune: on each beat through the note and the quiet after it (up to three beats
 * from its start, half a beat short of the next tune note, not where an echo or
 * run plays), with a finger the moment leaves free, the next chord tone in the opposite
 * direction to the tune's last step (down when it rose or held), starting from
 * the harmony under the note (or the chord tone a third to a sixth under it),
 * 3–15 semitones under the tune, on a string below the tune's, near the hand
 * and playable with everything at that moment. As `harmony` notes at 0.7 of the
 * tune's velocity, taking their string from the pattern while they ring.
 * `wants(tick)`: whether the bar of the held note asks for it.
 */
export function addCounterLine(events: readonly NoteEvent[], spans: readonly ChordSpan[], wants: (tick: number) => boolean): NoteEvent[] {
  const tune = events.filter((e) => e.melody).sort((a, b) => a.tick - b.tick);
  let out = [...events];
  tune.forEach((t, i) => {
    if (t.dur < HELD || !wants(t.tick)) return;
    const top = midiOf(t);
    const before = tune[i - 1];
    const dir = before && midiOf(before) > top ? 1 : -1;
    const under = out.filter((e) => e.harmony && e.tick === t.tick && e.string < t.string).sort((a, b) => midiOf(b) - midiOf(a))[0];
    let voice = under ? midiOf(under) : undefined;
    let prev: Pick<NoteEvent, 'fret'> | undefined = under;
    // Through the note and the quiet after it, stopping half a beat before the next tune note.
    const until = Math.min(t.tick + COUNTER_SPAN, (tune[i + 1]?.tick ?? Infinity) - TICKS_PER_BEAT / 2);
    for (let tick = Math.ceil((t.tick + 1) / TICKS_PER_BEAT) * TICKS_PER_BEAT; tick < until; tick += TICKS_PER_BEAT) {
      // An echo or a run already answers here.
      if (out.some((e) => e.fill && e.tick <= tick && tick < e.tick + e.dur)) break;
      const span = spanAt(spans, tick);
      if (!span) break;
      const tones = chordTones(span.played);
      const fits = (m: number) => tones.has(((m % 12) + 12) % 12) && top - m >= COUNTER_BELOW_MIN && top - m <= COUNTER_BELOW_MAX;
      let target: number | undefined;
      if (voice === undefined) {
        for (let m = top - COUNTER_BELOW_MIN; m >= top - 9 && target === undefined; m--) if (fits(m)) target = m;
      } else {
        for (let m = voice + dir; Math.abs(m - voice) <= 9 && target === undefined; m += dir) if (fits(m)) target = m;
      }
      if (target === undefined) break;
      const avoid = new Set([...out.filter((e) => e.tick === tick && e.finger === 'p').map((e) => e.string), ...[5, 4, 3, 2].filter((s) => s >= t.string)]);
      const spot = placeNear(target, span, prev, avoid);
      if (!spot || OPEN_MIDI[spot.string] + spot.fret !== target) break;
      const dur = Math.min(TICKS_PER_BEAT, until - tick);
      const atTick = out.filter((e) => e.tick === tick && e.string !== spot.string && (e.melody || e.harmony || e.finger === 'p'));
      // A finger the moment leaves free (the thumb plays the bass).
      const finger = (['i', 'm', 'a'] as const).find((f) => !atTick.some((e) => e.finger === f) && !(tick < t.tick + t.dur && t.finger === f));
      if (!finger) break;
      const note: NoteEvent = { tick, dur, string: spot.string, fret: spot.fret, finger, velocity: Math.round(t.velocity * COUNTER_VELOCITY * 100) / 100, harmony: true };
      if (!isPlayable([...(tick < t.tick + t.dur ? [t] : []), ...atTick, note], span.voicing)) break;
      out = place(out, note);
      voice = target;
      prev = note;
    }
  });
  return out.sort((a, b) => a.tick - b.tick || a.string - b.string);
}
