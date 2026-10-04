import type { AnalysisResult } from '@thumbline/engine';
import { barSpans } from './bars';

const base: AnalysisResult = {
  version: 1,
  durationSec: 30,
  bpm: 120,
  beatTimesSec: [],
  barStartBeat: 0,
  meter: { beatsPerBar: 4 },
  key: { pc: 0, mode: 'major' },
  chords: [],
};

describe('barSpans', () => {
  it('uses the detected beats, not a steady tempo', () => {
    // A pickup beat, then bars that slow down.
    const beatTimesSec = [0.1, 0.6, 1.1, 1.6, 2.1, 2.7, 3.3, 3.9, 4.5, 5.2];
    const spans = barSpans({ ...base, beatTimesSec, barStartBeat: 1 }, 2);
    expect(spans).toEqual([
      { start: 0.6, end: 2.7 },
      { start: 2.7, end: 5.2 },
    ]);
  });

  it('carries on at the tempo past the last detected beat', () => {
    const beatTimesSec = [0, 0.5, 1, 1.5, 2];
    const spans = barSpans({ ...base, beatTimesSec }, 3);
    expect(spans[1]).toEqual({ start: 2, end: 4 });
    expect(spans[2]).toEqual({ start: 4, end: 6 });
  });

  it('follows the meter', () => {
    const beatTimesSec = Array.from({ length: 13 }, (_, i) => i * 0.5);
    const spans = barSpans({ ...base, beatTimesSec, meter: { beatsPerBar: 3 } }, 2);
    expect(spans).toEqual([
      { start: 0, end: 1.5 },
      { start: 1.5, end: 3 },
    ]);
  });

  it('stops at the end of the clip', () => {
    const spans = barSpans({ ...base, durationSec: 5, beatTimesSec: [0, 0.5, 1, 1.5] }, 4);
    expect(spans[2]).toEqual({ start: 4, end: 5 });
    expect(spans[3]).toEqual({ start: 5, end: 5 });
  });

  it('works without detected beats', () => {
    expect(barSpans(base, 2)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });
});
