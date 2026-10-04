import { type EssentiaLike, loadEssentia } from './essentia.js';
import type { FromWorker, ToWorker } from './messages.js';
import { AnalysisError, analyzeSamples } from './pipeline.js';

function mixdown(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0]?.length ?? 0);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** (L − R) / 2 for stereo clips: what's left when the centre (usually the lead vocal) cancels. */
function sideOf(channels: readonly Float32Array[]): Float32Array | undefined {
  if (channels.length !== 2) return undefined;
  const [l, r] = channels;
  const out = new Float32Array(l.length);
  for (let i = 0; i < out.length; i++) out[i] = (l[i] - r[i]) / 2;
  return out;
}

type Scope = {
  postMessage: (msg: FromWorker) => void;
  addEventListener: (type: 'message', fn: (e: { data: unknown }) => void) => void;
};

/**
 * Worker side. In the app's worker file: `serveAnalysis(self)`.
 * Essentia is loaded on the first request and reused.
 */
export function serveAnalysis(scope: Scope, load: () => Promise<EssentiaLike> = loadEssentia) {
  let essentia: Promise<EssentiaLike> | null = null;
  scope.addEventListener('message', async (e) => {
    const msg = e.data as ToWorker;
    if (msg?.type !== 'analyze') return;
    try {
      essentia ??= load();
      const result = await analyzeSamples(mixdown(msg.channels), msg.sampleRate, {
        essentia: await essentia,
        side: sideOf(msg.channels),
        onProgress: (progress) => scope.postMessage({ type: 'progress', progress }),
      });
      scope.postMessage({ type: 'result', result });
    } catch (err) {
      essentia = null;
      const error = err instanceof Error ? err : new Error(String(err));
      scope.postMessage({
        type: 'error',
        error: { name: error.name, message: error.message, code: error instanceof AnalysisError ? error.code : undefined },
      });
    }
  });
}
