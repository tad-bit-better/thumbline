import type { EssentiaLike, EssentiaVector } from './essentia.js';
import { type BeatFeatures, detectMeter, extendBeats, toSegments } from './postprocess.js';
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
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
};

const FRAME = 4096;
const HOP = 2048;
const FRAMES_PER_SLICE = 160;
const SILENT_RMS = 1e-4;
const NOTE_NAMES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const free = (...vs: Array<EssentiaVector | undefined>) => vs.forEach((v) => v?.delete());
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
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
export async function analyzeSamples(samples: Float32Array, sampleRate: number, { essentia: e, onProgress, signal }: AnalyzeOptions): Promise<AnalysisResult> {
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
    const rhythm = e.RhythmExtractor2013(signalVec, 208, 'multifeature', 40);
    ticks = Array.from(e.vectorToArray(rhythm.ticks));
    free(rhythm.ticks);
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

  // Per-beat chroma: average HPCP of the frames centred in each beat.
  const beats = beatTimesSec.length;
  const sums = Array.from({ length: beats }, () => new Float64Array(12));
  const counts = new Uint32Array(beats);
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
    const frameVec = e.arrayToVector(samples.subarray(f * HOP, f * HOP + FRAME));
    const w = e.Windowing(frameVec, true, FRAME, 'blackmanharris62');
    const sp = e.Spectrum(w.frame, FRAME);
    const pk = e.SpectralPeaks(sp.spectrum, 0.00001, 5000, 100, 40, 'magnitude', sampleRate);
    const h = e.HPCP(pk.frequencies, pk.magnitudes, true, 500, 8, 5000, false, 40, false, 'unitMax', 440, sampleRate, 12, 'cosine', 1);
    const hpcp = e.vectorToArray(h.hpcp);
    // Essentia's bin 0 is A (440 Hz reference); rotate so bin 0 is C.
    for (let i = 0; i < 12; i++) sums[beat][(i + 9) % 12] += hpcp[i];
    counts[beat]++;
    free(frameVec, w.frame, sp.spectrum, pk.frequencies, pk.magnitudes, h.hpcp);
  }

  const features: BeatFeatures[] = beatTimesSec.map((t, b) => {
    const end = b + 1 < beats ? beatTimesSec[b + 1] : Math.min(durationSec, t + intervals[0]);
    return {
      chroma: Array.from(sums[b], (v) => v / Math.max(1, counts[b])),
      energy: rms(samples, Math.floor(t * sampleRate), Math.min(samples.length, Math.floor(end * sampleRate))),
    };
  });
  const meter = detectMeter(features);
  const chords = toSegments(features, meter.beatsPerBar, meter.firstDownbeat);

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
