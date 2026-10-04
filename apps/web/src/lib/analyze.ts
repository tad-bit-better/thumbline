import { type Progress, analyzeFile } from '@thumbline/audio-analysis';
import type { AnalysisResult } from '@thumbline/engine';

/** Analyse a clip in a fresh worker. */
export function analyze(file: File, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<AnalysisResult> {
  return analyzeFile(file, {
    createWorker: () => new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' }),
    onProgress,
    signal,
  }) as Promise<AnalysisResult>;
}
