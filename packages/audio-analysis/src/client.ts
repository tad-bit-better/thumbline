import { type Decoded, decodeToMono } from './decode.js';
import type { FromWorker, ToWorker } from './messages.js';
import { ANALYSIS_SAMPLE_RATE, AnalysisError, type AnalysisErrorCode, type Progress } from './pipeline.js';
import type { AnalysisResult } from './types.js';

/** PLAN §1: MP3, WAV, M4A up to 6 minutes. */
export const MAX_SECONDS = 6 * 60;
const TYPES = /^audio\/(mpeg|mp3|wav|x-wav|wave|vnd\.wave|mp4|x-m4a|m4a|aac)$/;
const EXTENSIONS = /\.(mp3|wav|m4a)$/i;
const DECODE_SHARE = 0.1;

export type AnalyzeFileOptions = {
  /** e.g. `() => new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })`. */
  createWorker: () => Worker;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  /** Override decoding (tests). */
  decode?: (file: Blob) => Promise<Decoded>;
};

/** A known audio type, or a known extension when the browser's type is missing or generic. */
const GENERIC_TYPES = new Set(['', 'application/octet-stream', 'video/mp4']);
export function isSupportedFile(file: { name: string; type: string }) {
  return TYPES.test(file.type) || (GENERIC_TYPES.has(file.type) && EXTENSIONS.test(file.name));
}

const aborted = () => new DOMException('Analysis cancelled', 'AbortError');

/** Decode on the main thread, analyse in a worker. Cancel with `signal`. */
export async function analyzeFile(file: File, { createWorker, onProgress, signal, decode = decodeToMono }: AnalyzeFileOptions): Promise<AnalysisResult> {
  if (signal?.aborted) throw aborted();
  if (!isSupportedFile(file)) throw new AnalysisError('unsupported', 'Use an MP3, WAV or M4A file.');

  onProgress?.({ step: 'decode', fraction: 0 });
  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new AnalysisError('unsupported', 'We couldn’t read this file. Try an MP3, WAV or M4A.');
  }
  if (signal?.aborted) throw aborted();
  if ((decoded.channels[0]?.length ?? 0) / decoded.sampleRate > MAX_SECONDS) {
    throw new AnalysisError('too-long', 'Clips can be up to 6 minutes long.');
  }
  onProgress?.({ step: 'decode', fraction: DECODE_SHARE });

  const worker = createWorker();
  return new Promise<AnalysisResult>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };
    const onAbort = () => {
      finish();
      reject(aborted());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.addEventListener('message', (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.({ ...msg.progress, fraction: DECODE_SHARE + (1 - DECODE_SHARE) * msg.progress.fraction });
      } else if (msg.type === 'result') {
        finish();
        resolve(msg.result);
      } else {
        finish();
        const { name, message, code } = msg.error;
        reject(name === 'AnalysisError' && code ? new AnalysisError(code as AnalysisErrorCode, message) : new Error(message));
      }
    });
    const request: ToWorker = { type: 'analyze', channels: decoded.channels, sampleRate: ANALYSIS_SAMPLE_RATE };
    worker.postMessage(request, decoded.channels.map((c) => c.buffer));
  });
}
