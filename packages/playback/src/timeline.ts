import type { Arrangement } from '@thumbline/engine';

/** engine-spec convention: 480 ticks per beat. */
export const TICKS_PER_BEAT = 480;

/** Beat grid detected in the recording (from the AnalysisResult). */
export type Beats = { beatTimesSec: readonly number[]; barStartBeat: number };

export type Timeline = {
  /** Song seconds for a tick: seconds into the original recording when beats are known. */
  tickToSec: (tick: number) => number;
  secToTick: (sec: number) => number;
  barToSec: (bar: number) => number;
  /** Song seconds at the end of the last bar. */
  endSec: number;
};

/**
 * Maps ticks to song seconds. With the recording's beat times the sheet
 * follows its real tempo drift; otherwise it uses the steady bpm.
 */
export function createTimeline(a: Pick<Arrangement, 'bpm' | 'meter' | 'bars'>, beats?: Beats): Timeline {
  const barTicks = a.meter.beatsPerBar * TICKS_PER_BEAT;
  const bt = beats?.beatTimesSec ?? [];
  let tickToSec: (tick: number) => number;
  let secToTick: (sec: number) => number;

  if (bt.length >= 2 && beats) {
    const n = bt.length;
    const first = bt[1] - bt[0];
    const last = bt[n - 1] - bt[n - 2];
    const base = beats.barStartBeat;
    tickToSec = (tick) => {
      const b = base + tick / TICKS_PER_BEAT;
      if (b <= 0) return bt[0] + b * first;
      if (b >= n - 1) return bt[n - 1] + (b - (n - 1)) * last;
      const i = Math.floor(b);
      return bt[i] + (b - i) * (bt[i + 1] - bt[i]);
    };
    secToTick = (sec) => {
      let b: number;
      if (sec <= bt[0]) b = (sec - bt[0]) / first;
      else if (sec >= bt[n - 1]) b = n - 1 + (sec - bt[n - 1]) / last;
      else {
        let lo = 0;
        let hi = n - 1;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (bt[mid] <= sec) lo = mid;
          else hi = mid;
        }
        b = lo + (sec - bt[lo]) / (bt[lo + 1] - bt[lo]);
      }
      return Math.max(0, (b - base) * TICKS_PER_BEAT);
    };
  } else {
    const secPerTick = 60 / a.bpm / TICKS_PER_BEAT;
    tickToSec = (tick) => tick * secPerTick;
    secToTick = (sec) => Math.max(0, sec / secPerTick);
  }

  return {
    tickToSec,
    secToTick,
    barToSec: (bar) => tickToSec(bar * barTicks),
    endSec: tickToSec(a.bars * barTicks),
  };
}
