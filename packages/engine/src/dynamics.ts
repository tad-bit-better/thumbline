import { TICKS_PER_BEAT } from './constants.js';
import type { BeatsPerBar, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string (shape space; the capo moves all equally). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;

/** Voice weights: the tune leads, the thumb holds the floor, the inner fingers stay under both. */
const BASS_WEIGHT = 0.82;
const INNER_WEIGHT = 0.66;
/** Where a pattern note falls in the bar. */
const DOWNBEAT = 1.1;
const MID_BAR = 1.04;
const OFF_EIGHTH = 0.92;
const OFF_SIXTEENTH = 0.85;
/** A gap this long (or longer) ends a phrase of the tune. */
const PHRASE_GAP = TICKS_PER_BEAT;
/** A phrase swells from 0.8 of its weight to its high point, and the last note eases off. */
const ARC_FLOOR = 0.8;
const ARC_RANGE = 0.25;
const PITCH_PULL = 0.015; // per semitone above or below the phrase's middle
const LAST_NOTE = 0.9;
const HELD = 1.05; // a note of a beat or more
const MIN_VELOCITY = 0.2;

const clamp = (v: number) => Math.min(1, Math.max(MIN_VELOCITY, Math.round(v * 100) / 100));
const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;

/**
 * engine-spec §4 dynamics: not every note weighs the same.
 * - Pattern: the thumb ×0.82, inner fingers ×0.66; then by place in the bar:
 *   the downbeat ×1.1, the middle of the bar ×1.04, off-eighths ×0.92, off-sixteenths ×0.85.
 * - The tune, phrase by phrase (a gap of a beat or more starts a new one): it swells
 *   from ×0.8 at the first note to ×1.05 at the phrase's highest note and falls back
 *   after it; higher notes lean a little more (±1.5% a semitone from the phrase's
 *   middle); a note held a beat or more ×1.05; the phrase's last note ×0.9.
 * Golpes, slaps and apagados keep their weight. Velocities stay within 0.2..1.
 */
export function shapeDynamics(events: NoteEvent[], beatsPerBar: BeatsPerBar): void {
  const bar = beatsPerBar * TICKS_PER_BEAT;
  const half = beatsPerBar % 2 === 0 ? bar / 2 : -1;
  for (const e of events) {
    if (e.melody || e.fret < 0) continue;
    const voice = e.finger === 'p' ? BASS_WEIGHT : INNER_WEIGHT;
    const at = e.tick % bar;
    const place = at === 0 ? DOWNBEAT : at === half ? MID_BAR : at % TICKS_PER_BEAT === 0 ? 1 : at % (TICKS_PER_BEAT / 2) === 0 ? OFF_EIGHTH : OFF_SIXTEENTH;
    e.velocity = clamp(e.velocity * voice * place);
  }

  const tune = events.filter((e) => e.melody).sort((a, b) => a.tick - b.tick);
  let start = 0;
  for (let i = 1; i <= tune.length; i++) {
    const gap = i < tune.length ? tune[i].tick - (tune[i - 1].tick + tune[i - 1].dur) : Infinity;
    if (gap < PHRASE_GAP) continue;
    shapePhrase(tune.slice(start, i));
    start = i;
  }
}

function shapePhrase(phrase: NoteEvent[]): void {
  if (!phrase.length) return;
  const pitches = phrase.map(midiOf);
  const middle = (Math.max(...pitches) + Math.min(...pitches)) / 2;
  const peak = pitches.indexOf(Math.max(...pitches));
  phrase.forEach((e, i) => {
    // Rise to the high point, fall away after it.
    const toward = peak === 0 ? 1 : i <= peak ? i / peak : 1 - (i - peak) / Math.max(1, phrase.length - 1 - peak);
    let w = ARC_FLOOR + ARC_RANGE * toward;
    w *= 1 + PITCH_PULL * (pitches[i] - middle);
    if (e.dur >= TICKS_PER_BEAT) w *= HELD;
    if (i === phrase.length - 1 && phrase.length > 1) w *= LAST_NOTE;
    e.velocity = clamp(e.velocity * w);
  });
}
