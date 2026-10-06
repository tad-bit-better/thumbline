import type { EssentiaLike, EssentiaVector } from './essentia.js';
import type { MelodyNote } from './types.js';

/** Notes shorter than this are tracker blips (consonants, slides), not sung notes. */
const MIN_NOTE_SEC = 0.09;
/** A note this far (semitones) from its neighbours' median is an octave slip. */
const OCTAVE_SLIP = 9;
/** How many notes either side vote on where the line is. */
const NEIGHBOURS = 3;
/** A held note the tracker split: same pitch, gap shorter than this. */
const MERGE_GAP_SEC = 0.12;
/** Out-of-key notes shorter than this are bends or slides into a key note. */
const SNAP_BELOW_SEC = 0.35;
/** Hop between pitch frames: 256 at 44.1 kHz is ~5.8 ms, half the work of essentia's default 128. */
export const MELODY_HOP = 256;

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const pcOf = (midi: number) => ((Math.round(midi) % 12) + 12) % 12;

type Key = { pc: number; mode: 'major' | 'minor' | 'phrygian' };

/**
 * engine-spec §1 melody cleanup, in order: drop blips; fix octave slips
 * against the median of the neighbours; merge a held note split in two;
 * snap short out-of-key notes a semitone into the key. `key` is the song's,
 * or, for a song that changes key, the key at a moment (seconds).
 */
export function cleanMelody(raw: readonly MelodyNote[], key: Key | ((sec: number) => Key)): MelodyNote[] {
  const notes = raw.filter((n) => n.durSec >= MIN_NOTE_SEC).map((n) => ({ ...n, midi: Math.round(n.midi) }));

  const fixed = notes.map((n, i) => {
    const around = [...notes.slice(Math.max(0, i - NEIGHBOURS), i), ...notes.slice(i + 1, i + 1 + NEIGHBOURS)].map((x) => x.midi).sort((a, b) => a - b);
    if (!around.length) return n;
    const median = around[Math.floor(around.length / 2)];
    let midi = n.midi;
    while (midi - median >= OCTAVE_SLIP) midi -= 12;
    while (median - midi >= OCTAVE_SLIP) midi += 12;
    return { ...n, midi };
  });

  const merged: MelodyNote[] = [];
  for (const n of fixed) {
    const last = merged.at(-1);
    if (last && last.midi === n.midi && n.startSec - (last.startSec + last.durSec) < MERGE_GAP_SEC) {
      last.durSec = n.startSec + n.durSec - last.startSec;
      last.confidence = Math.max(last.confidence, n.confidence);
    } else merged.push({ ...n });
  }

  const keyAt = typeof key === 'function' ? key : () => key;
  const scaleOf = (k: Key) => new Set((k.mode === 'major' ? MAJOR : MINOR).map((s) => (k.pc + s) % 12));
  for (const n of merged) {
    if (n.durSec >= SNAP_BELOW_SEC) continue;
    const scale = scaleOf(keyAt(n.startSec));
    if (scale.has(pcOf(n.midi))) continue;
    n.midi += scale.has(pcOf(n.midi - 1)) ? -1 : 1;
  }
  return merged;
}

const free = (...vs: Array<EssentiaVector | undefined>) => vs.forEach((v) => v?.delete());

/**
 * The lead voice as notes: equal-loudness filter, PredominantPitchMelodia
 * (pitch per frame), then PitchContourSegmentation (notes). Confidence is the
 * mean pitch confidence over each note's frames. Pitches are read against
 * `tuningHz` (the recording's A), so a record mastered off pitch still lands on notes.
 */
export function trackMelody(e: EssentiaLike, samples: Float32Array, sampleRate: number, tuningHz = 440): MelodyNote[] {
  const input = e.arrayToVector(samples);
  const eq = e.EqualLoudness(input, sampleRate);
  const m = e.PredominantPitchMelodia(eq.signal, 10, 3, 2048, false, 0.8, MELODY_HOP);
  const seg = e.PitchContourSegmentation(m.pitch, input, MELODY_HOP, MIN_NOTE_SEC, 60, -2, sampleRate, tuningHz);
  const onset = e.vectorToArray(seg.onset);
  const duration = e.vectorToArray(seg.duration);
  const midi = e.vectorToArray(seg.MIDIpitch);
  const conf = e.vectorToArray(m.pitchConfidence);
  free(input, eq.signal, m.pitch, m.pitchConfidence, seg.onset, seg.duration, seg.MIDIpitch);
  const frameSec = MELODY_HOP / sampleRate;
  return Array.from(onset, (startSec, i) => {
    const from = Math.floor(startSec / frameSec);
    const to = Math.max(from + 1, Math.floor((startSec + duration[i]) / frameSec));
    let sum = 0;
    for (let f = from; f < to && f < conf.length; f++) sum += conf[f];
    return { startSec, durSec: duration[i], midi: midi[i], confidence: Math.min(1, Math.max(0, sum / (to - from))) };
  });
}
