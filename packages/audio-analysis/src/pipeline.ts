import type { EssentiaLike, EssentiaVector } from './essentia.js';
import { type BeatFeatures, assignBass, detectMeter, extendBeats, foldBeats, keySections, lowBandAlternation, refineMode, toSegments } from './postprocess.js';
import { cleanMelody, trackMelody } from './melody.js';
import { beatEnergyOf, moodOf } from './mood.js';
import type { AnalysisResult, KeySpan } from './types.js';

export const ANALYSIS_SAMPLE_RATE = 44100;

export type AnalysisErrorCode = 'unsupported' | 'too-long' | 'too-short' | 'silent';

/** A problem with the clip itself, shown to the user with a retry. */
export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export type Progress = {
  step: 'decode' | 'beats' | 'key' | 'chords' | 'melody' | 'done';
  /** Overall 0..1. */
  fraction: number;
  detail?: { bpm?: number; beatsPerBar?: number; bar?: number; bars?: number };
};

export type AnalyzeOptions = {
  essentia: EssentiaLike;
  /**
   * Stereo side signal, (L − R) / 2. Lead vocals sit in the centre and cancel
   * here, so it carries the instruments' harmony. Omit for mono clips.
   */
  side?: Float32Array;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
};

const FRAME = 4096;
const HPCP_HARMONICS = 0;
const HOP = 2048;
const FRAMES_PER_SLICE = 160;
/** Bass band for the chord root: below the voice, above the kick's thump. */
const BASS_MIN_HZ = 40;
const BASS_MAX_HZ = 180;
/**
 * The bass is read from its own long frame (~0.74 s at 44.1 kHz, 1.3 Hz bins):
 * at 50 Hz a semitone is 3 Hz, so the chroma frames (10.8 Hz bins) can't tell
 * a sub-bass G#1 from G1 or A1. Bass-heavy mixes (EDM) put the chord root there.
 */
const BASS_FRAME = 32768;
const BASS_LOW_HZ = 30;
/** Side signal this much quieter than the mix (RMS) is treated as mono. */
const MIN_SIDE_RATIO = 0.08;
const SILENT_RMS = 1e-4;
/** Below this low-band alternation, a tracked tempo twice Percival's is trusted. */
const DOUBLE_IS_REAL_BELOW = 0.6;
/** Tuning: one frame this often, spectral peaks in this band, offsets under this many cents ignored. */
const TUNING_STEP_SEC = 0.25;
const TUNING_MIN_HZ = 80;
const TUNING_MAX_HZ = 2500;
const TUNING_MIN_CENTS = 6;
const TUNING_SMOOTH_CENTS = 5;
const TUNING_WINDOW_CENTS = 15;
/** Votes within the window must beat an even spread by this share, or the peaks don't share a tuning: keep A440. */
const TUNING_MIN_FOCUS = 0.1;
const NOTE_NAMES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const free = (...vs: Array<EssentiaVector | undefined>) => vs.forEach((v) => v?.delete());
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
}

const ticksOf = (e: EssentiaLike, r: { ticks: EssentiaVector }) => {
  const out = Array.from(e.vectorToArray(r.ticks));
  free(r.ticks);
  return out;
};
const tempoOf = (ticks: number[]) => {
  const iv = ticks.slice(1).map((t, i) => t - ticks[i]).sort((a, b) => a - b);
  return iv.length ? 60 / iv[Math.floor(iv.length / 2)] : 0;
};
const near = (ratio: number, target: number, tolerance: number) => Math.abs(ratio - target) <= tolerance * target;

/** Second-pass tempo windows around Percival's tempo, narrow first. Essentia rejects some narrow windows outright. */
const RETRY_SPREADS = [0.15, 0.25, 0.4];

/**
 * Beat positions from Degara's tracker, with Percival's estimator as a
 * second opinion on the tempo. Trackers often lock onto the picked eighth
 * notes of a solo guitar (double tempo); kick and bass on beats 1 and 3
 * show when the faster reading is real (see the eval for the numbers).
 * The second pass widens its window when essentia rejects it, and keeps the
 * first pass's beats if every window fails: a beat grid, even at double
 * tempo, beats refusing the song.
 */
export function trackBeats(e: EssentiaLike, signalVec: EssentiaVector, samples: Float32Array, sampleRate: number): number[] {
  let reference = 0;
  try {
    reference = e.PercivalBpmEstimator(signalVec).bpm;
  } catch {
    reference = 0; // no second opinion: trust the tracker
  }
  const ticks = ticksOf(e, e.RhythmExtractor2013(signalVec, 208, 'degara', 40));
  const tracked = tempoOf(ticks);
  if (!reference || !tracked || near(tracked / reference, 1, 0.06)) return ticks;
  if (near(tracked / reference, 2, 0.06) && lowBandAlternation(samples, sampleRate, ticks) < DOUBLE_IS_REAL_BELOW) return ticks;
  for (const spread of RETRY_SPREADS) {
    const min = Math.max(40, Math.round(reference * (1 - spread)));
    const max = Math.min(208, Math.round(reference * (1 + spread)));
    if (min >= max) continue;
    try {
      const retry = ticksOf(e, e.RhythmExtractor2013(signalVec, max, 'degara', min));
      if (retry.length >= 4) return retry;
    } catch {
      // essentia rejected this window (e.g. 52–70 bpm): try a wider one
    }
  }
  return ticks;
}

function rms(x: Float32Array, from = 0, to = x.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

/**
 * Mono 44.1 kHz samples → AnalysisResult (engine-spec §1): beats and tempo
 * (RhythmExtractor2013), key (KeyExtractor), per-beat HPCP chroma, then our
 * chord templates, meter and bar snapping (postprocess.ts).
 */
export async function analyzeSamples(samples: Float32Array, sampleRate: number, { essentia: e, onProgress, signal, side: sideInput }: AnalyzeOptions): Promise<AnalysisResult> {
  if (sampleRate !== ANALYSIS_SAMPLE_RATE) throw new RangeError(`analyzeSamples needs ${ANALYSIS_SAMPLE_RATE} Hz audio, got ${sampleRate}`);
  if (rms(samples) < SILENT_RMS) throw new AnalysisError('silent', 'We couldn’t hear anything in this clip.');
  const report = (p: Progress) => onProgress?.(p);
  const durationSec = samples.length / sampleRate;

  report({ step: 'beats', fraction: 0.02 });
  await tick();
  checkAborted(signal);
  const signalVec = e.arrayToVector(samples);
  let ticks: number[];
  try {
    ticks = trackBeats(e, signalVec, samples, sampleRate);
  } catch {
    ticks = [];
  }
  if (ticks.length < 4) {
    free(signalVec);
    throw new AnalysisError('too-short', 'This clip is too short to find a beat.');
  }
  // Rubato stretches counted on another pulse fold back to the song's beat (M10b), so bar lines don't slip.
  const beatTimesSec = extendBeats(foldBeats(ticks));
  const intervals = beatTimesSec.slice(1).map((t, i) => t - beatTimesSec[i]).sort((a, b) => a - b);
  const bpm = Math.round((60 / intervals[Math.floor(intervals.length / 2)]) * 10) / 10;

  report({ step: 'key', fraction: 0.45, detail: { bpm } });
  await tick();
  checkAborted(signal);
  // Old records were often mastered off speed: read every pitch against the recording's own A.
  const cents = estimateTuning(e, samples, sampleRate);
  const tuningHz = 440 * 2 ** (cents / 1200);
  const k = e.KeyExtractor(signalVec, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', sampleRate, 0.0001, tuningHz);
  // Mood signals (M10): cheap (~1.5 s for 4 minutes), and optional: a failure leaves the mood out.
  let feel: { onsetRate: number; danceability: number } | undefined;
  try {
    const onsets = e.OnsetRate(signalVec);
    const dance = e.Danceability(signalVec);
    feel = { onsetRate: onsets.onsetRate, danceability: dance.danceability };
    free(onsets.onsets, dance.dfa);
  } catch {
    feel = undefined;
  }
  free(signalVec);
  const key = { pc: NOTE_NAMES[k.key] ?? 0, mode: k.scale === 'minor' ? ('minor' as const) : ('major' as const) };

  // Per-beat chroma: average HPCP of the frames centred in each beat, for
  // the mix, its bass band and (when the clip is stereo) the side signal.
  const side = sideInput && sideInput.length === samples.length && rms(sideInput) >= MIN_SIDE_RATIO * rms(samples) ? sideInput : undefined;
  const beats = beatTimesSec.length;
  const sums = Array.from({ length: beats }, () => new Float64Array(12));
  const bassSums = Array.from({ length: beats }, () => new Float64Array(12));
  const sideSums = side ? Array.from({ length: beats }, () => new Float64Array(12)) : undefined;
  const counts = new Uint32Array(beats);
  const chromaOf = (x: Float32Array, from: number, add: (bin: number, v: number) => void, addBass?: (bin: number, v: number) => void) => {
    const frameVec = e.arrayToVector(x.subarray(from, from + FRAME));
    const w = e.Windowing(frameVec, true, FRAME, 'blackmanharris62');
    const sp = e.Spectrum(w.frame, FRAME);
    const pk = e.SpectralPeaks(sp.spectrum, 0.00001, 5000, 100, 40, 'magnitude', sampleRate);
    if (pk.frequencies.size() === 0) {
      free(frameVec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes); // silence: nothing to add
      return;
    }
    // harmonics = 0: overtones are modelled in the chord templates instead.
    const h = e.HPCP(pk.frequencies, pk.magnitudes, true, 500, HPCP_HARMONICS, 5000, false, 40, false, 'unitMax', tuningHz, sampleRate, 12, 'cosine', 1);
    // Essentia's bin 0 is A (the tuning reference); rotate so bin 0 is C.
    const hpcp = e.vectorToArray(h.hpcp);
    for (let i = 0; i < 12; i++) add((i + 9) % 12, hpcp[i]);
    if (addBass) {
      // Bass chroma straight from the peaks (essentia's HPCP won't take a band this narrow).
      const freqs = e.vectorToArray(pk.frequencies);
      const mags = e.vectorToArray(pk.magnitudes);
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] < BASS_MIN_HZ || freqs[i] > BASS_MAX_HZ) continue;
        const midi = 69 + 12 * Math.log2(freqs[i] / tuningHz);
        addBass(((Math.round(midi) % 12) + 12) % 12, mags[i] * mags[i]);
      }
    }
    free(frameVec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes, h.hpcp);
  };
  const frames = Math.max(0, Math.floor((samples.length - FRAME) / HOP) + 1);
  const bars = Math.ceil(beats / 4);
  let beat = 0;
  for (let f = 0; f < frames; f++) {
    if (f % FRAMES_PER_SLICE === 0) {
      report({ step: 'chords', fraction: 0.5 + 0.3 * (f / frames), detail: { bar: Math.min(bars, Math.floor(beat / 4) + 1), bars } });
      await tick();
      checkAborted(signal);
    }
    const centre = (f * HOP + FRAME / 2) / sampleRate;
    while (beat + 1 < beats && centre >= beatTimesSec[beat + 1]) beat++;
    if (centre < beatTimesSec[0]) continue;
    const at = beat;
    chromaOf(samples, f * HOP, (i, v) => (sums[at][i] += v), (i, v) => (bassSums[at][i] += v));
    if (side && sideSums) chromaOf(side, f * HOP, (i, v) => (sideSums[at][i] += v));
    counts[beat]++;
  }

  const fineBass = bassPerBeat(e, samples, sampleRate, beatTimesSec, durationSec, tuningHz);
  const features: BeatFeatures[] = beatTimesSec.map((t, b) => {
    const end = b + 1 < beats ? beatTimesSec[b + 1] : Math.min(durationSec, t + intervals[0]);
    const n = Math.max(1, counts[b]);
    return {
      chroma: Array.from(sums[b], (v) => v / n),
      bass: fineBass[b] ?? Array.from(bassSums[b], (v) => v / n),
      side: sideSums ? Array.from(sideSums[b], (v) => v / n) : undefined,
      energy: rms(samples, Math.floor(t * sampleRate), Math.min(samples.length, Math.floor(end * sampleRate))),
    };
  });
  const meter = detectMeter(features);
  const brightnessHz = brightness(e, samples, sampleRate);
  const firstPass = toSegments(features, meter.beatsPerBar, meter.firstDownbeat, key);
  // The key finder confuses relative keys (C major / A minor): the chords say which is home.
  // Songs that change key (M10b): find where, then choose the chords again with each section's key.
  const found = keySections(firstPass, meter.beatsPerBar, refineMode(key, firstPass, meter.beatsPerBar));
  const voiced = found.length > 1 ? toSegments(features, meter.beatsPerBar, meter.firstDownbeat, found) : firstPass;
  // The song's own bass under each chord (M11b): Cm over an Ab sub-bass is Cm/Ab.
  const chords = assignBass(voiced, features, meter.beatsPerBar, meter.firstDownbeat);
  const keys = found.length > 1 ? keySections(chords, meter.beatsPerBar, found[0].key) : found;
  const homeKey = longestKey(keys, chords.at(-1)?.bar ?? 0);
  const keyAtSec = (sec: number) => {
    let beat = 0;
    while (beat + 1 < beatTimesSec.length && beatTimesSec[beat + 1] <= sec) beat++;
    const bar = Math.floor((beat - meter.firstDownbeat) / meter.beatsPerBar);
    return [...keys].reverse().find((k) => k.bar <= bar)?.key ?? keys[0].key;
  };

  // The tune (M9): one pass over the whole clip, so progress jumps once.
  report({ step: 'melody', fraction: 0.82, detail: { bpm, beatsPerBar: meter.beatsPerBar } });
  await tick();
  checkAborted(signal);
  let melody: AnalysisResult['melody'];
  try {
    melody = cleanMelody(trackMelody(e, samples, sampleRate, tuningHz), keys.length > 1 ? keyAtSec : homeKey);
  } catch {
    melody = undefined; // a sheet without the tune beats no sheet
  }

  report({ step: 'done', fraction: 1, detail: { bpm, beatsPerBar: meter.beatsPerBar } });
  return {
    version: 1,
    durationSec,
    bpm,
    beatTimesSec,
    barStartBeat: meter.firstDownbeat,
    meter: { beatsPerBar: meter.beatsPerBar },
    key: homeKey,
    chords,
    ...(keys.length > 1 ? { keys } : {}),
    ...(melody?.length ? { melody } : {}),
    ...(feel && brightnessHz !== undefined ? { mood: moodOf({ bpm, ...feel, brightnessHz, mode: homeKey.mode, chords }) } : {}),
    beatEnergy: beatEnergyOf(features.map((f) => f.energy)),
    ...(cents ? { tuningCents: cents } : {}),
  };
}

/**
 * Bass pitch classes per beat from one long frame centred on the beat (engine-spec §1):
 * spectral peaks from 30 to 180 Hz, energy (magnitude²) by pitch class.
 * A beat too near either end of the clip for the frame keeps the short-frame bass.
 */
function bassPerBeat(e: EssentiaLike, samples: Float32Array, sampleRate: number, beats: readonly number[], durationSec: number, tuningHz: number): Array<number[] | undefined> {
  const scale = sampleRate / 44100;
  const frame = Math.round((BASS_FRAME * scale) / 2) * 2;
  return beats.map((t, b) => {
    const end = b + 1 < beats.length ? beats[b + 1] : Math.min(durationSec, t + (t - (beats[b - 1] ?? t - 0.5)));
    const from = Math.round(((t + end) / 2) * sampleRate) - frame / 2;
    if (from < 0 || from + frame > samples.length) return undefined;
    const vec = e.arrayToVector(samples.subarray(from, from + frame));
    const w = e.Windowing(vec, true, frame, 'blackmanharris92');
    const sp = e.Spectrum(w.frame, frame);
    const pk = e.SpectralPeaks(sp.spectrum, 0.00001, BASS_MAX_HZ, 30, BASS_LOW_HZ, 'magnitude', sampleRate);
    const out = new Array<number>(12).fill(0);
    if (pk.frequencies.size() === 0) {
      free(vec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes); // silence: no bass
      return out;
    }
    const freqs = e.vectorToArray(pk.frequencies);
    const mags = e.vectorToArray(pk.magnitudes);
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] < BASS_LOW_HZ || freqs[i] > BASS_MAX_HZ) continue;
      const midi = 69 + 12 * Math.log2(freqs[i] / tuningHz);
      out[((Math.round(midi) % 12) + 12) % 12] += mags[i] * mags[i];
    }
    free(vec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes);
    return out;
  });
}

/**
 * engine-spec §1 tuning: how far the recording sits from A440, in whole cents
 * (−50..50). Every quarter second, the spectral peaks from 80 Hz to 2.5 kHz
 * each vote with their magnitude for their offset from the nearest A440
 * semitone, on a circle a semitone round (so −49 and +51 agree). The tuning is
 * the most voted offset (votes smoothed over ±5 cents), so drums and other
 * unpitched peaks, spread round the circle, don't pull it. Offsets under
 * 6 cents (inaudible against a guitar), or votes that don't gather (under a tenth within ±15 cents of the
 * winner beyond an even spread), read as 0.
 */
export function estimateTuning(e: EssentiaLike, samples: Float32Array, sampleRate: number): number {
  const step = Math.floor(TUNING_STEP_SEC * sampleRate);
  const votes = new Float64Array(100);
  for (let from = 0; from + FRAME <= samples.length; from += step) {
    const vec = e.arrayToVector(samples.subarray(from, from + FRAME));
    const w = e.Windowing(vec, true, FRAME, 'blackmanharris62');
    const sp = e.Spectrum(w.frame, FRAME);
    const pk = e.SpectralPeaks(sp.spectrum, 0.00001, TUNING_MAX_HZ, 30, TUNING_MIN_HZ, 'magnitude', sampleRate);
    if (pk.frequencies.size() === 0) {
      free(vec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes); // silence: no vote
      continue;
    }
    const freqs = e.vectorToArray(pk.frequencies);
    const mags = e.vectorToArray(pk.magnitudes);
    free(vec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes);
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] < TUNING_MIN_HZ) continue;
      const c = 1200 * Math.log2(freqs[i] / 440);
      votes[((Math.round(c) % 100) + 100) % 100] += mags[i];
    }
  }
  const total = votes.reduce((a, v) => a + v, 0);
  if (!total) return 0;
  const around = (bin: number, half: number) => {
    let sum = 0;
    for (let d = -half; d <= half; d++) sum += votes[(bin + d + 100) % 100];
    return sum;
  };
  let best = 0;
  for (let b = 1; b < 100; b++) if (around(b, TUNING_SMOOTH_CENTS) > around(best, TUNING_SMOOTH_CENTS)) best = b;
  const share = around(best, TUNING_WINDOW_CENTS) / total;
  const even = (2 * TUNING_WINDOW_CENTS + 1) / 100;
  if (share - even < TUNING_MIN_FOCUS) return 0;
  // Refine inside the window: the votes' circular mean there.
  let x = 0;
  let y = 0;
  for (let d = -TUNING_WINDOW_CENTS; d <= TUNING_WINDOW_CENTS; d++) {
    const bin = (best + d + 100) % 100;
    const angle = (2 * Math.PI * bin) / 100;
    x += votes[bin] * Math.cos(angle);
    y += votes[bin] * Math.sin(angle);
  }
  const cents = Math.round((Math.atan2(y, x) * 100) / (2 * Math.PI));
  return Math.abs(cents) < TUNING_MIN_CENTS ? 0 : cents;
}

/** The key held for the most bars (the first on a tie). */
function longestKey(keys: readonly KeySpan[], lastBar: number): KeySpan['key'] {
  let best = keys[0];
  let bestBars = -1;
  keys.forEach((k, i) => {
    const bars = (keys[i + 1]?.bar ?? lastBar + 1) - k.bar;
    if (bars > bestBars) [best, bestBars] = [k, bars];
  });
  return best.key;
}

/** Mean spectral centroid (Hz) over one frame every half second: how bright the mix sounds. */
function brightness(e: EssentiaLike, samples: Float32Array, sampleRate: number): number | undefined {
  try {
    const size = 2048;
    const step = Math.floor(sampleRate / 2);
    let sum = 0;
    let n = 0;
    for (let i = 0; i + size < samples.length; i += step) {
      const frame = e.arrayToVector(samples.subarray(i, i + size));
      const w = e.Windowing(frame, true, size, 'hann');
      const sp = e.Spectrum(w.frame, size);
      const c = e.Centroid(sp.spectrum, sampleRate / 2).centroid;
      free(frame, w.frame, sp.spectrum);
      if (Number.isFinite(c) && c > 0) {
        sum += c;
        n++;
      }
    }
    return n ? sum / n : undefined;
  } catch {
    return undefined;
  }
}
