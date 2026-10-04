import { parseChord } from '../chords.js';
import type { AnalysisResult, BeatsPerBar, ChordSegment } from '../types.js';

/**
 * Test helper: an AnalysisResult from a chord chart such as `G | D | Em C`.
 * Chords in a bar split it evenly; `-` is a bar of silence.
 */
export function progression(chart: string, beatsPerBar: BeatsPerBar = 4, bpm = 90): AnalysisResult {
  const bars = chart.split('|').map((b) => b.trim().split(/\s+/).filter(Boolean));
  const chords: ChordSegment[] = [];
  bars.forEach((tokens, bar) => {
    tokens.forEach((token, i) => {
      const parsed = token === '-' ? null : parseChord(token);
      if (token !== '-' && !parsed) throw new Error(`Not a chord: ${token}`);
      chords.push({
        bar,
        beat: Math.floor((i * beatsPerBar) / tokens.length),
        chord: parsed ? parsed.label : null,
        confidence: 1,
        alternatives: [],
      });
    });
  });
  const beatSec = 60 / bpm;
  const beats = bars.length * beatsPerBar;
  return {
    version: 1,
    durationSec: beats * beatSec,
    bpm,
    beatTimesSec: Array.from({ length: beats }, (_, i) => i * beatSec),
    barStartBeat: 0,
    meter: { beatsPerBar },
    key: { pc: 0, mode: 'major' },
    chords,
  };
}

/** The five progressions from the prototype, used for snapshots. */
export const PROGRESSIONS: ReadonlyArray<{ name: string; chart: string; beatsPerBar: BeatsPerBar }> = [
  { name: 'Pop loop in G', chart: 'G | D | Em | C | G | D | C | C', beatsPerBar: 4 },
  { name: 'Ballad in C', chart: 'C | G/B | Am | Am/G | F | C/E | Dm7 | G', beatsPerBar: 4 },
  { name: 'Waltz in D', chart: 'D | D | G | A7 | D | Bm | Em7 | A7', beatsPerBar: 3 },
  { name: 'Minor in Am', chart: 'Am | F | C | G | Am | Dm | E7 | Am', beatsPerBar: 4 },
  { name: 'Sharp key (F#)', chart: 'F# | D#m | B | C#', beatsPerBar: 4 },
];
