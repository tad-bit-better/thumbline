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

  it('hears chords under a loud centred voice in a stereo clip', async () => {
    const s = scope();
    serveAnalysis(s.self, async () => loadEssentiaNode());
    const clip = chordClip(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F']);
    // A steady voice on D (not in C or G or F), equally loud in both channels; the guitar sits mostly left.
    const voice = clip.map((_, i) => 0.5 * Math.sin((2 * Math.PI * 587.33 * i) / 44100));
    const left = clip.map((v, i) => v + voice[i]);
    const right = clip.map((v, i) => 0.2 * v + voice[i]);
    s.send({ type: 'analyze', channels: [left, right], sampleRate: 44100 });
    await done(s.posted);
    const { result } = s.posted.find((m) => m.type === 'result') as unknown as { result: { chords: Array<{ chord: { pc: number } | null }> } };
    const roots = result.chords.flatMap((c) => (c.chord ? [c.chord.pc] : []));
    expect(roots.slice(0, 4)).toEqual([0, 7, 9, 5]);
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
