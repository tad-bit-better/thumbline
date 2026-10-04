import { loadEssentiaNode } from './testing/node-essentia.js';
import { chordClip } from './testing/synth.js';
import { serveAnalysis } from './worker.js';

function scope() {
  const posted: Array<{ type: string; [k: string]: unknown }> = [];
  let handler: ((e: { data: unknown }) => void) | null = null;
  return {
    posted,
    self: {
      postMessage: (m: { type: string }) => posted.push(m),
      addEventListener: (_: 'message', fn: (e: { data: unknown }) => void) => {
        handler = fn;
      },
    },
    send: (data: unknown) => handler?.({ data }),
  };
}

const done = (posted: Array<{ type: string }>) =>
  new Promise<void>((resolve) => {
    const t = setInterval(() => {
      if (posted.some((m) => m.type === 'result' || m.type === 'error')) {
        clearInterval(t);
        resolve();
      }
    }, 20);
  });

describe('serveAnalysis', () => {
  it('analyses samples and posts progress then the result', async () => {
    const s = scope();
    serveAnalysis(s.self, async () => loadEssentiaNode());
    const clip = chordClip(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F']);
    s.send({ type: 'analyze', channels: [clip, Float32Array.from(clip)], sampleRate: 44100 });
    await done(s.posted);
    expect(s.posted.some((m) => m.type === 'progress')).toBe(true);
    const result = s.posted.find((m) => m.type === 'result') as unknown as { result: { bpm: number } };
    expect(Math.abs(result.result.bpm - 100)).toBeLessThan(2);
  }, 60000);

  it('posts clip errors with their code', async () => {
    const s = scope();
    serveAnalysis(s.self, async () => loadEssentiaNode());
    s.send({ type: 'analyze', channels: [new Float32Array(44100 * 3)], sampleRate: 44100 });
    await done(s.posted);
    expect(s.posted.find((m) => m.type === 'error')).toMatchObject({ error: { name: 'AnalysisError', code: 'silent' } });
  });

  it('posts a load failure as an error', async () => {
    const s = scope();
    serveAnalysis(s.self, () => Promise.reject(new Error('no wasm')));
    s.send({ type: 'analyze', channels: [new Float32Array(10)], sampleRate: 44100 });
    await done(s.posted);
    expect(s.posted.find((m) => m.type === 'error')).toMatchObject({ error: { message: 'no wasm' } });
  });

  it('ignores unknown messages', () => {
    const s = scope();
    serveAnalysis(s.self, async () => loadEssentiaNode());
    s.send({ type: 'hello' });
    expect(s.posted).toEqual([]);
  });
});
