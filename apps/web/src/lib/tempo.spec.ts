import type { AnalysisResult } from '@thumbline/engine';
import { scaleTempo } from './tempo';

// Read at 152 bpm (0.4 s a beat) with bar 0 on beat 1: a ballad counted twice too fast.
const doubled: AnalysisResult = {
  version: 1,
  durationSec: 7,
  bpm: 152,
  beatTimesSec: Array.from({ length: 17 }, (_, i) => 0.2 + i * 0.4),
  barStartBeat: 1,
  meter: { beatsPerBar: 4 },
  key: { pc: 5, mode: 'major' },
  keys: [
    { bar: 0, key: { pc: 5, mode: 'major' } },
    { bar: 2, key: { pc: 7, mode: 'major' } },
  ],
  chords: [
    { bar: 0, beat: 0, chord: { pc: 5, quality: 'maj' }, confidence: 1, alternatives: [] },
    { bar: 2, beat: 0, chord: { pc: 0, quality: 'maj' }, confidence: 1, alternatives: [] },
    { bar: 3, beat: 2, chord: { pc: 2, quality: 'm' }, confidence: 1, alternatives: [] },
  ],
  beatEnergy: Array.from({ length: 17 }, (_, i) => i / 16),
  melody: [{ startSec: 1, durSec: 0.5, midi: 69, confidence: 0.9 }],
};

describe('scaleTempo', () => {
  it('halves: every other beat from the downbeat, chords and key changes at the same moment', () => {
    const half = scaleTempo(doubled, 0.5);
    expect(half.bpm).toBe(76);
    expect(half.beatTimesSec).toEqual(doubled.beatTimesSec.filter((_, i) => i % 2 === 1));
    // Bar 0's downbeat stays where it was.
    expect(half.beatTimesSec[half.barStartBeat]).toBe(doubled.beatTimesSec[doubled.barStartBeat]);
    expect(half.chords.map((c) => [c.bar, c.beat])).toEqual([
      [0, 0],
      [1, 0],
      [1, 3],
    ]);
    expect(half.keys?.map((k) => k.bar)).toEqual([0, 1]);
    expect(half.beatEnergy?.[0]).toBeCloseTo((1 / 16 + 2 / 16) / 2);
    expect(half.melody).toEqual(doubled.melody);
  });

  it('doubles: a beat between each two, everything counted twice as far', () => {
    const slow = scaleTempo(doubled, 0.5);
    const back = scaleTempo(slow, 2);
    expect(back.bpm).toBe(152);
    expect(back.beatTimesSec[1] - back.beatTimesSec[0]).toBeCloseTo(0.4);
    expect(back.beatTimesSec[back.barStartBeat]).toBe(slow.beatTimesSec[slow.barStartBeat]);
    expect(back.chords.map((c) => [c.bar, c.beat])).toEqual([
      [0, 0],
      [2, 0],
      [3, 2],
    ]);
    expect(back.keys?.map((k) => k.bar)).toEqual([0, 2]);
  });

  it('leaves the song alone at 1', () => {
    expect(scaleTempo(doubled, 1)).toBe(doubled);
  });
});
