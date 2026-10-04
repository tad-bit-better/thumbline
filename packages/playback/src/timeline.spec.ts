import { createTimeline } from './timeline.js';

const meter = { beatsPerBar: 4 as const };

describe('createTimeline', () => {
  it('uses the steady bpm without beat times', () => {
    const t = createTimeline({ bpm: 120, meter, bars: 2 });
    expect(t.tickToSec(480)).toBeCloseTo(0.5);
    expect(t.tickToSec(1920)).toBeCloseTo(2);
    expect(t.endSec).toBeCloseTo(4);
    expect(t.secToTick(1)).toBeCloseTo(960);
  });

  it('starts at the downbeat of bar 0 in the recording', () => {
    const beatTimesSec = [0.3, 0.8, 1.3, 1.8, 2.3, 2.8, 3.3, 3.8, 4.3];
    const t = createTimeline({ bpm: 120, meter, bars: 2 }, { beatTimesSec, barStartBeat: 1 });
    expect(t.tickToSec(0)).toBeCloseTo(0.8);
    expect(t.tickToSec(480 * 3)).toBeCloseTo(2.3);
  });

  it('follows tempo drift between beats and interpolates within a beat', () => {
    const beatTimesSec = [0, 0.5, 1.1, 1.8];
    const t = createTimeline({ bpm: 120, meter, bars: 1 }, { beatTimesSec, barStartBeat: 0 });
    expect(t.tickToSec(480 * 2)).toBeCloseTo(1.1);
    expect(t.tickToSec(480 * 2 + 240)).toBeCloseTo(1.45);
  });

  it('extrapolates past the last detected beat with the last interval', () => {
    const t = createTimeline({ bpm: 120, meter, bars: 2 }, { beatTimesSec: [0, 0.5, 1.1, 1.8], barStartBeat: 0 });
    expect(t.tickToSec(480 * 5)).toBeCloseTo(1.8 + 2 * 0.7);
    expect(t.endSec).toBeCloseTo(1.8 + 5 * 0.7);
  });

  it('falls back to the bpm with fewer than two beats', () => {
    const t = createTimeline({ bpm: 60, meter, bars: 1 }, { beatTimesSec: [2], barStartBeat: 0 });
    expect(t.tickToSec(480)).toBeCloseTo(1);
  });

  it('inverts tickToSec', () => {
    const t = createTimeline({ bpm: 90, meter, bars: 8 }, { beatTimesSec: [0.1, 0.72, 1.31, 1.97, 2.6, 3.21], barStartBeat: 0 });
    for (const tick of [0, 100, 480, 1000, 2400, 5000, 15360]) {
      expect(t.secToTick(t.tickToSec(tick))).toBeCloseTo(tick, 6);
    }
  });

  it('clamps secToTick before the start', () => {
    const t = createTimeline({ bpm: 120, meter, bars: 1 }, { beatTimesSec: [1, 1.5, 2], barStartBeat: 0 });
    expect(t.secToTick(0)).toBe(0);
  });
});
