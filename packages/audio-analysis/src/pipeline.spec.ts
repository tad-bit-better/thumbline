import { AnalysisError, analyzeSamples, estimateTuning, type Progress, trackBeats } from './pipeline.js';
import { loadEssentiaNode } from './testing/node-essentia.js';
import { chordClip } from './testing/synth.js';
import type { AnalysisResult } from './types.js';

const essentia = loadEssentiaNode();
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SUFFIX: Record<string, string> = { maj: '', m: 'm', '7': '7', m7: 'm7', maj7: 'maj7', sus2: 'sus2', sus4: 'sus4', dim: 'dim' };
const chordAt = (r: AnalysisResult, bar: number) => {
  const seg = [...r.chords].reverse().find((s) => s.bar <= bar);
  return seg?.chord ? NAMES[seg.chord.pc] + SUFFIX[seg.chord.quality] : '-';
};

describe('analyzeSamples', () => {
  const chart = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G', 'C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G'];
  let result: AnalysisResult;
  const progress: Progress[] = [];

  beforeAll(async () => {
    result = await analyzeSamples(chordClip(chart, { bpm: 100 }), 44100, { essentia, onProgress: (p) => progress.push(p) });
  }, 60000);

  it('finds the tempo', () => {
    expect(Math.abs(result.bpm - 100)).toBeLessThan(1.5);
  });

  it('returns the beat grid, starting near the beginning', () => {
    expect(result.beatTimesSec.length).toBeGreaterThan(60);
    expect(result.beatTimesSec[0]).toBeLessThan(0.65);
    for (let i = 1; i < result.beatTimesSec.length; i++) expect(result.beatTimesSec[i]).toBeGreaterThan(result.beatTimesSec[i - 1]);
  });

  it('leaves a recording at A440 alone (no tuning offset)', () => {
    expect(result.tuningCents).toBeUndefined();
  });

  it('finds 4/4 and the key', () => {
    expect(result.meter.beatsPerBar).toBe(4);
    expect(result.key).toEqual({ pc: 0, mode: 'major' });
  });

  it('hears the chords bar by bar', () => {
    const bars = Math.min(chart.length, Math.max(...result.chords.map((c) => c.bar)) + 1);
    let right = 0;
    for (let b = 0; b < bars; b++) if (chordAt(result, b) === chart[b]) right++;
    expect(right / bars).toBeGreaterThanOrEqual(0.85);
  });

  it('fills in the contract fields', () => {
    expect(result.version).toBe(1);
    expect(result.durationSec).toBeCloseTo(chordClip(chart).length / 44100, 3);
    expect(result.barStartBeat).toBeGreaterThanOrEqual(0);
    for (const c of result.chords) {
      expect(c.alternatives.length).toBeLessThanOrEqual(3);
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('reports progress through each step, ending at 1', () => {
    const steps = [...new Set(progress.map((p) => p.step))];
    expect(steps).toEqual(['beats', 'key', 'chords', 'melody', 'done']);
    for (let i = 1; i < progress.length; i++) expect(progress[i].fraction).toBeGreaterThanOrEqual(progress[i - 1].fraction);
    expect(progress.at(-1)?.fraction).toBe(1);
    expect(progress.find((p) => p.step === 'key')?.detail).toMatchObject({ bpm: expect.any(Number) });
    expect(progress.at(-1)?.detail).toMatchObject({ bpm: expect.any(Number), beatsPerBar: 4 });
    expect(progress.filter((p) => p.step === 'chords').at(-1)?.detail).toMatchObject({ bar: expect.any(Number), bars: expect.any(Number) });
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const p = analyzeSamples(chordClip(chart), 44100, {
      essentia,
      signal: controller.signal,
      onProgress: (e) => e.step === 'chords' && controller.abort(),
    });
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  }, 60000);

  it('refuses silence', async () => {
    await expect(analyzeSamples(new Float32Array(44100 * 5), 44100, { essentia })).rejects.toMatchObject({
      code: 'silent',
    });
  });

  it('refuses clips too short to find a beat', async () => {
    const err = await analyzeSamples(chordClip(['C']).subarray(0, 44100), 44100, { essentia }).catch((e) => e);
    expect(err).toBeInstanceOf(AnalysisError);
    expect(err.code).toBe('too-short');
  });

  it('requires 44.1 kHz input', async () => {
    await expect(analyzeSamples(new Float32Array(48000), 48000, { essentia })).rejects.toThrow(/44100/);
  });
});

describe('tuning', () => {
  const chart = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G', 'C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G'];
  const bars = (r: AnalysisResult) => {
    const n = Math.min(chart.length, Math.max(...r.chords.map((c) => c.bar)) + 1);
    let right = 0;
    for (let b = 0; b < n; b++) if (chordAt(r, b) === chart[b]) right++;
    return right / n;
  };

  it('measures how far a recording sits from A440', () => {
    expect(estimateTuning(essentia, chordClip(chart, { cents: -40 }), 44100)).toBeCloseTo(-40, -1);
    expect(estimateTuning(essentia, chordClip(chart, { cents: 25 }), 44100)).toBeCloseTo(25, -1);
    expect(Math.abs(estimateTuning(essentia, chordClip(chart), 44100))).toBeLessThan(5);
  });

  it('hears the chords of a record mastered off pitch, and reports the offset', async () => {
    const r = await analyzeSamples(chordClip(chart, { bpm: 100, cents: -45 }), 44100, { essentia });
    expect(r.tuningCents).toBeCloseTo(-45, -1);
    expect(r.key).toEqual({ pc: 0, mode: 'major' });
    expect(bars(r)).toBeGreaterThanOrEqual(0.85);
  }, 60000);
});

describe('trackBeats', () => {
  // A fake essentia: the first pass finds double tempo; the narrow retry window is rejected.
  const vec = (xs: number[]) => ({ size: () => xs.length, get: (i: number) => xs[i], delete: () => undefined });
  const beatsAt = (bpm: number, n = 40) => Array.from({ length: n }, (_, i) => (i * 60) / bpm);
  const fake = (rejectBelowSpread: number) => {
    const calls: Array<[number, number]> = [];
    const e = {
      PercivalBpmEstimator: () => ({ bpm: 60 }),
      vectorToArray: (v: ReturnType<typeof vec>) => Float32Array.from({ length: v.size() }, (_, i) => v.get(i)),
      RhythmExtractor2013: (_s: unknown, max = 208, _m = 'degara', min = 40) => {
        calls.push([min, max]);
        if (max === 208 && min === 40) return { bpm: 184, ticks: vec(beatsAt(184)), confidence: 1 };
        if ((max - min) / 60 < rejectBelowSpread) throw new Error('essentia: bad parameters');
        return { bpm: 60, ticks: vec(beatsAt(60)), confidence: 1 };
      },
    } as unknown as Parameters<typeof trackBeats>[0];
    return { e, calls };
  };
  const quiet = new Float32Array(44100 * 4);

  it('widens the second pass when essentia rejects a narrow tempo window', () => {
    const { e, calls } = fake(0.4);
    const ticks = trackBeats(e, vec([]) as never, quiet, 44100);
    expect(calls.length).toBeGreaterThan(2);
    expect(ticks[1] - ticks[0]).toBeCloseTo(1); // 60 bpm
  });

  it('keeps the first pass when every window is rejected, rather than failing the song', () => {
    const { e } = fake(10);
    const ticks = trackBeats(e, vec([]) as never, quiet, 44100);
    expect(ticks.length).toBe(40);
  });
});
