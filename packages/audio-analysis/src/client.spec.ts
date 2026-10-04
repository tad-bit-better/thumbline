import { analyzeFile, type AnalyzeFileOptions } from './client.js';
import { AnalysisError, type Progress } from './pipeline.js';
import type { AnalysisResult } from './types.js';

type Listener = (e: { data: unknown }) => void;

class FakeWorker {
  sent: unknown[] = [];
  terminated = false;
  private listeners: Listener[] = [];
  addEventListener(_: 'message', fn: Listener) {
    this.listeners.push(fn);
  }
  removeEventListener() {
    this.listeners = [];
  }
  postMessage(msg: unknown) {
    this.sent.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    for (const fn of this.listeners) fn({ data });
  }
}

const RESULT = { version: 1, bpm: 92 } as unknown as AnalysisResult;
const file = (name = 'song.mp3', type = 'audio/mpeg') => new File([new Uint8Array(8)], name, { type });

function setup(extra: Partial<AnalyzeFileOptions> = {}) {
  const worker = new FakeWorker();
  const progress: Progress[] = [];
  const options: AnalyzeFileOptions = {
    createWorker: () => worker as unknown as Worker,
    decode: async () => ({ channels: [new Float32Array(44100 * 10), new Float32Array(44100 * 10)], sampleRate: 44100 }),
    onProgress: (p) => progress.push(p),
    ...extra,
  };
  return { worker, progress, options };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('analyzeFile', () => {
  it('decodes, hands the samples to the worker and returns its result', async () => {
    const { worker, options, progress } = setup();
    const p = analyzeFile(file(), options);
    await flush();
    expect(worker.sent[0]).toMatchObject({ type: 'analyze', sampleRate: 44100 });
    worker.emit({ type: 'progress', progress: { step: 'chords', fraction: 0.5 } });
    worker.emit({ type: 'result', result: RESULT });
    await expect(p).resolves.toBe(RESULT);
    expect(worker.terminated).toBe(true);
    expect(progress[0]).toMatchObject({ step: 'decode' });
    expect(progress.find((x) => x.step === 'chords')?.fraction).toBeCloseTo(0.1 + 0.9 * 0.5);
  });

  it.each([
    ['notes.pdf', 'application/pdf'],
    ['song.flac', 'audio/flac'],
  ])('rejects %s as unsupported', async (name, type) => {
    const { options } = setup();
    await expect(analyzeFile(file(name, type), options)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('accepts by extension when the browser gives no type', async () => {
    const { worker, options } = setup();
    const p = analyzeFile(file('take1.m4a', ''), options);
    await flush();
    worker.emit({ type: 'result', result: RESULT });
    await expect(p).resolves.toBe(RESULT);
  });

  it('reports files it cannot decode as unsupported', async () => {
    const { options } = setup({ decode: () => Promise.reject(new Error('EncodingError')) });
    await expect(analyzeFile(file(), options)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('rejects clips longer than eight minutes', async () => {
    const { options } = setup({ decode: async () => ({ channels: [new Float32Array(44100 * 481)], sampleRate: 44100 }) });
    await expect(analyzeFile(file(), options)).rejects.toMatchObject({ code: 'too-long', message: 'Clips can be up to 8 minutes long.' });
  });

  it('passes clip errors from the worker through', async () => {
    const { worker, options } = setup();
    const p = analyzeFile(file(), options);
    await flush();
    worker.emit({ type: 'error', error: { name: 'AnalysisError', code: 'silent', message: 'quiet' } });
    const err = await p.catch((e) => e);
    expect(err).toBeInstanceOf(AnalysisError);
    expect(err.code).toBe('silent');
  });

  it('turns unexpected worker errors into plain errors', async () => {
    const { worker, options } = setup();
    const p = analyzeFile(file(), options);
    await flush();
    worker.emit({ type: 'error', error: { name: 'Error', message: 'boom' } });
    await expect(p).rejects.toThrow('boom');
  });

  it('cancels by terminating the worker', async () => {
    const controller = new AbortController();
    const { worker, options } = setup({ signal: controller.signal });
    const p = analyzeFile(file(), options);
    await flush();
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
  });

  it('does not start when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const { options } = setup({ signal: controller.signal });
    await expect(analyzeFile(file(), options)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
