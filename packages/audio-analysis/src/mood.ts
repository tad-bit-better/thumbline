import type { ChordSegment, Mood } from './types.js';

/** What the mood is read from (engine-spec §1 mood). */
export type MoodSignals = {
  bpm: number;
  /** onsets per second (essentia OnsetRate) */
  onsetRate: number;
  /** essentia Danceability, roughly 0..3 (1.5+ is danceable) */
  danceability: number;
  /** mean spectral centroid, Hz */
  brightnessHz: number;
  mode: 'major' | 'minor' | 'phrygian';
  chords: readonly ChordSegment[];
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const norm = (x: number, lo: number, hi: number) => clamp01((x - lo) / (hi - lo));
const MAJOR_QUALITIES = new Set(['maj', '7', 'maj7', '6', 'add9']);

/**
 * engine-spec §1 mood, two numbers in 0..1.
 * energy (calm → driving): tempo 40%, onset rate 30%, danceability 30%.
 * valence (dark → bright): a major key 55%, the share of major chords 25%, brightness 20%.
 * MUSIC-REVIEW: weights and ranges are a first guess, calibrated on two dark, calm songs only;
 * they need an upbeat major-key song to check the other end.
 */
export function moodOf(s: MoodSignals): Mood {
  const energy = 0.4 * norm(s.bpm, 60, 140) + 0.3 * norm(s.onsetRate, 1.5, 5) + 0.3 * norm(s.danceability, 0.8, 2);
  const chords = s.chords.filter((c) => c.chord);
  const majorShare = chords.length ? chords.filter((c) => c.chord && MAJOR_QUALITIES.has(c.chord.quality)).length / chords.length : 0.5;
  const valence = 0.55 * (s.mode === 'major' ? 1 : 0) + 0.25 * majorShare + 0.2 * norm(s.brightnessHz, 1200, 3000);
  const round = (x: number) => Math.round(clamp01(x) * 100) / 100;
  return { energy: round(energy), valence: round(valence) };
}

/** Loudness per beat, scaled so the loud end of the song (95th percentile) is 1. */
export function beatEnergyOf(rmsPerBeat: readonly number[]): number[] {
  if (!rmsPerBeat.length) return [];
  const sorted = [...rmsPerBeat].sort((a, b) => a - b);
  const top = sorted[Math.floor((sorted.length - 1) * 0.95)] || 1;
  return rmsPerBeat.map((r) => Math.round(clamp01(r / top) * 100) / 100);
}
