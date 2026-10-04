import type { Progress } from './pipeline.js';
import type { AnalysisResult } from './types.js';

/** Channels at 44.1 kHz; the worker mixes them to mono. */
export type ToWorker = { type: 'analyze'; channels: Float32Array[]; sampleRate: number };

export type FromWorker =
  | { type: 'progress'; progress: Progress }
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; error: { name: string; message: string; code?: string } };
