import type { EssentiaLike, EssentiaVector } from './essentia.js';
import { type BeatFeatures, detectMeter, extendBeats, lowBandAlternation, toSegments } from './postprocess.js';
import type { AnalysisResult } from './types.js';

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
  step: 'decode' | 'beats' | 'key' | 'chords' | 'done';
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
/** Side signal this much quieter than the mix (RMS) is treated as mono. */
const MIN_SIDE_RATIO = 0.08;
const SILENT_RMS = 1e-4;
/** Below this low-band alternation, a tracked tempo twice Percival's is trusted. */
const DOUBLE_IS_REAL_BELOW = 0.6;
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

/**
 * Beat positions from Degara's tracker, with Percival's estimator as a
 * second opinion on the tempo. Trackers often lock onto the picked eighth
 * notes of a solo guitar (double tempo); kick and bass on beats 1 and 3
 * show when the faster reading is real (see the eval for the numbers).
 */
function trackBeats(e: EssentiaLike, signalVec: EssentiaVector, samples: Float32Array, sampleRate: number): number[] {
  const reference = e.PercivalBpmEstimator(signalVec).bpm;
  const ticks = ticksOf(e, e.RhythmExtractor2013(signalVec, 208, 'degara', 40));
  const tracked = tempoOf(ticks);
  if (!reference || !tracked || near(tracked / reference, 1, 0.06)) return ticks;
  if (near(tracked / reference, 2, 0.06) && lowBandAlternation(samples, sampleRate, ticks) < DOUBLE_IS_REAL_BELOW) return ticks;
  const min = Math.max(40, Math.round(reference * 0.85));
  const max = Math.min(208, Math.round(reference * 1.15));
  return ticksOf(e, e.RhythmExtractor2013(signalVec, max, 'degara', min));
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
  const beatTimesSec = extendBeats(ticks);
  const intervals = beatTimesSec.slice(1).map((t, i) => t - beatTimesSec[i]).sort((a, b) => a - b);
  const bpm = Math.round((60 / intervals[Math.floor(intervals.length / 2)]) * 10) / 10;

  report({ step: 'key', fraction: 0.45, detail: { bpm } });
  await tick();
  checkAborted(signal);
  const k = e.KeyExtractor(signalVec);
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
    const h = e.HPCP(pk.frequencies, pk.magnitudes, true, 500, HPCP_HARMONICS, 5000, false, 40, false, 'unitMax', 440, sampleRate, 12, 'cosine', 1);
    // Essentia's bin 0 is A (440 Hz reference); rotate so bin 0 is C.
    const hpcp = e.vectorToArray(h.hpcp);
    for (let i = 0; i < 12; i++) add((i + 9) % 12, hpcp[i]);
    if (addBass) {
      // Bass chroma straight from the peaks (essentia's HPCP won't take a band this narrow).
      const freqs = e.vectorToArray(pk.frequencies);
      const mags = e.vectorToArray(pk.magnitudes);
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] < BASS_MIN_HZ || freqs[i] > BASS_MAX_HZ) continue;
        const midi = 69 + 12 * Math.log2(freqs[i] / 440);
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
      report({ step: 'chords', fraction: 0.5 + 0.48 * (f / frames), detail: { bar: Math.min(bars, Math.floor(beat / 4) + 1), bars } });
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

  const features: BeatFeatures[] = beatTimesSec.map((t, b) => {
    const end = b + 1 < beats ? beatTimesSec[b + 1] : Math.min(durationSec, t + intervals[0]);
    const n = Math.max(1, counts[b]);
    return {
      chroma: Array.from(sums[b], (v) => v / n),
      bass: Array.from(bassSums[b], (v) => v / n),
      side: sideSums ? Array.from(sideSums[b], (v) => v / n) : undefined,
      energy: rms(samples, Math.floor(t * sampleRate), Math.min(samples.length, Math.floor(end * sampleRate))),
    };
  });
  const meter = detectMeter(features);
  const chords = toSegments(features, meter.beatsPerBar, meter.firstDownbeat, key);

  report({ step: 'done', fraction: 1, detail: { bpm, beatsPerBar: meter.beatsPerBar } });
  return {
    version: 1,
    durationSec,
    bpm,
    beatTimesSec,
    barStartBeat: meter.firstDownbeat,
    meter: { beatsPerBar: meter.beatsPerBar },
    key,
    chords,
  };
}
