import {
  type AnalysisResult,
  type Arrangement,
  type BeatsPerBar,
  type ChordSegment,
  type Level,
  type NoteEvent,
  type Style,
  arrange,
  parseChord,
} from '@thumbline/engine';

/** A chord chart such as `G | D | Em C` as an AnalysisResult. */
export function analysis(chart: string, beatsPerBar: BeatsPerBar = 4): AnalysisResult {
  const bars = chart.split('|').map((b) => b.trim().split(/\s+/).filter(Boolean));
  const chords: ChordSegment[] = bars.flatMap((tokens, bar) =>
    tokens.map((t, i) => ({
      bar,
      beat: Math.floor((i * beatsPerBar) / tokens.length),
      chord: parseChord(t)?.label ?? null,
      confidence: 1,
      alternatives: [],
    })),
  );
  const beats = bars.length * beatsPerBar;
  return {
    version: 1,
    durationSec: beats * (60 / 90),
    bpm: 90,
    beatTimesSec: Array.from({ length: beats }, (_, i) => (i * 60) / 90),
    barStartBeat: 0,
    meter: { beatsPerBar },
    key: { pc: 7, mode: 'major' },
    chords,
  };
}

/** A real engine arrangement for a chart. */
export function sheet(chart: string, style: Style = 'arpeggio', level: Level = 'basic', beatsPerBar: BeatsPerBar = 4): Arrangement {
  return arrange(analysis(chart, beatsPerBar), { style, level });
}

/** A song of `bars` bars cycling through a pop loop. */
export function longSheet(bars: number, style: Style = 'fingerstyle', level: Level = 'advanced'): Arrangement {
  const loop = ['G', 'D', 'Em', 'C'];
  return sheet(Array.from({ length: bars }, (_, i) => loop[i % 4]).join(' | '), style, level);
}

/**
 * Hand-built arrangement for technique stories and tests, since flamenco
 * patterns arrive in M7. Uses an open E minor shape.
 */
export function techniqueSheet(events: Array<Partial<NoteEvent> & Pick<NoteEvent, 'tick' | 'string' | 'fret'>>, bars = 1): Arrangement {
  return {
    style: 'flamenco',
    level: 'advanced',
    patternId: 'test.techniques',
    capo: 0,
    meter: { beatsPerBar: 4 },
    bpm: 100,
    bars,
    chordMarks: [
      {
        tick: 0,
        soundingName: 'Em',
        voicing: { name: 'Em', frets: [0, 2, 2, 0, 0, 0], rootString: 0, barre: false },
      },
    ],
    events: events
      .map((e) => ({ dur: 240, finger: 'i' as const, velocity: 0.8, ...e }))
      .sort((a, b) => a.tick - b.tick || a.string - b.string),
    warnings: [],
  };
}
