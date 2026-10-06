// Ambient types for essentia's untyped ES builds must travel with this file to consumers
// that compile it from source (the web app); an import can't load a .d.ts at runtime.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./essentia-modules.d.ts" />
/** The parts of essentia.js the pipeline uses (its own types are incomplete). */
export type EssentiaVector = { size(): number; get(i: number): number; delete(): void };

export type EssentiaLike = {
  arrayToVector(input: Float32Array): EssentiaVector;
  vectorToArray(input: EssentiaVector): Float32Array;
  RhythmExtractor2013(signal: EssentiaVector, maxTempo?: number, method?: string, minTempo?: number): { bpm: number; ticks: EssentiaVector; confidence: number };
  PercivalBpmEstimator(signal: EssentiaVector): { bpm: number };
  KeyExtractor(
    audio: EssentiaVector,
    averageDetuningCorrection?: boolean,
    frameSize?: number,
    hopSize?: number,
    hpcpSize?: number,
    maxFrequency?: number,
    maximumSpectralPeaks?: number,
    minFrequency?: number,
    pcpThreshold?: number,
    profileType?: string,
    sampleRate?: number,
    spectralPeaksThreshold?: number,
    tuningFrequency?: number,
  ): { key: string; scale: string; strength: number };
  Windowing(frame: EssentiaVector, normalized?: boolean, size?: number, type?: string): { frame: EssentiaVector };
  Spectrum(frame: EssentiaVector, size?: number): { spectrum: EssentiaVector };
  SpectralPeaks(
    spectrum: EssentiaVector,
    magnitudeThreshold?: number,
    maxFrequency?: number,
    maxPeaks?: number,
    minFrequency?: number,
    orderBy?: string,
    sampleRate?: number,
  ): { frequencies: EssentiaVector; magnitudes: EssentiaVector };
  HPCP(
    frequencies: EssentiaVector,
    magnitudes: EssentiaVector,
    bandPreset?: boolean,
    bandSplitFrequency?: number,
    harmonics?: number,
    maxFrequency?: number,
    maxShifted?: boolean,
    minFrequency?: number,
    nonLinear?: boolean,
    normalized?: string,
    referenceFrequency?: number,
    sampleRate?: number,
    size?: number,
    weightType?: string,
    windowSize?: number,
  ): { hpcp: EssentiaVector };
  EqualLoudness(signal: EssentiaVector, sampleRate?: number): { signal: EssentiaVector };
  OnsetRate(signal: EssentiaVector): { onsetRate: number; onsets: EssentiaVector };
  Danceability(signal: EssentiaVector): { danceability: number; dfa: EssentiaVector };
  Centroid(array: EssentiaVector, range?: number): { centroid: number };
  PredominantPitchMelodia(
    signal: EssentiaVector,
    binResolution?: number,
    filterIterations?: number,
    frameSize?: number,
    guessUnvoiced?: boolean,
    harmonicWeight?: number,
    hopSize?: number,
  ): { pitch: EssentiaVector; pitchConfidence: EssentiaVector };
  PitchContourSegmentation(
    pitch: EssentiaVector,
    signal: EssentiaVector,
    hopSize?: number,
    minDuration?: number,
    pitchDistanceThreshold?: number,
    rmsThreshold?: number,
    sampleRate?: number,
    tuningFrequency?: number,
  ): { onset: EssentiaVector; duration: EssentiaVector; MIDIpitch: EssentiaVector };
};

/**
 * Load essentia's single-file ES build (WASM inlined). Call it inside a
 * Web Worker: browsers only allow synchronous WASM compilation there.
 */
export async function loadEssentia(): Promise<EssentiaLike> {
  const [wasm, core] = await Promise.all([
    import('essentia.js/dist/essentia-wasm.es.js'),
    import('essentia.js/dist/essentia.js-core.es.js'),
  ]);
  return new core.default(wasm.EssentiaWASM) as EssentiaLike;
}
