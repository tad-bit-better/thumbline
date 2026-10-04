import { arrange } from './arrange.js';
import { parseChord } from './chords.js';
import { mergeMelody, melodyShift, placeMelody, quantiseMelody, secToTick } from './melody.js';
import { type ChordSpan, isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, ChordLabel, MelodyNote, NoteEvent } from './types.js';
import { getVoicing } from './voicings.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
/** 120 bpm: a beat every 0.5 s, bar 0 on the first beat. */
const GRID = { beatTimesSec: Array.from({ length: 64 }, (_, i) => i * 0.5), barStartBeat: 0 };
const note = (startSec: number, durSec: number, midi: number): MelodyNote => ({ startSec, durSec, midi, confidence: 0.8 });

function span(name: string, start = 0, end = 1920): ChordSpan {
  const label = (parseChord(name) as { label: ChordLabel }).label;
  const { voicing, played } = getVoicing(label, 'moderate');
  return { start, end, voicing, played };
}

describe('secToTick', () => {
  it('maps seconds through the beat grid, following tempo drift', () => {
    const toTick = secToTick([1, 1.5, 2.1, 2.8], 1);
    expect(toTick(1.5)).toBe(0);
    expect(toTick(1.8)).toBeCloseTo(240);
    expect(toTick(2.45)).toBeCloseTo(720);
  });

  it('extrapolates before the first beat and after the last', () => {
    const toTick = secToTick([1, 1.5, 2], 0);
    expect(toTick(0.75)).toBeCloseTo(-240);
    expect(toTick(2.5)).toBeCloseTo(1440);
  });
});

describe('quantiseMelody', () => {
  it('puts onsets on the nearest 16th and holds each note to the next', () => {
    const line = quantiseMelody({ ...GRID, melody: [note(0.02, 0.4, 69), note(0.49, 0.2, 71)] }, 'moderate', 7680);
    expect(line).toEqual([
      { tick: 0, dur: 480, midi: 69 },
      { tick: 480, dur: 360, midi: 71 },
    ]);
  });

  it('keeps one note per 16th, the longer one', () => {
    const line = quantiseMelody({ ...GRID, melody: [note(1.0, 0.1, 69), note(1.02, 0.4, 72)] }, 'advanced', 7680);
    expect(line.map((n) => n.midi)).toEqual([72]);
  });

  it('gives Basic one note per beat, tying a held note over', () => {
    // A held for two beats, then B on the "and" of beat 3, then C on beat 4
    const line = quantiseMelody({ ...GRID, melody: [note(0, 1.0, 69), note(1.25, 0.25, 71), note(1.5, 0.5, 72)] }, 'basic', 7680);
    expect(line.map((n) => [n.tick, n.midi])).toEqual([
      [0, 69],
      [1440, 72],
    ]);
  });

  it('drops notes before bar 0 and after the song', () => {
    const line = quantiseMelody({ beatTimesSec: GRID.beatTimesSec, barStartBeat: 4, melody: [note(0.5, 0.3, 69), note(2.5, 0.3, 71)] }, 'moderate', 1920);
    expect(line.map((n) => n.midi)).toEqual([71]);
  });
});

describe('placeMelody', () => {
  it('shifts the tune by octaves so its middle sits on the top strings', () => {
    expect(melodyShift([{ tick: 0, dur: 480, midi: 55 }], 0)).toBe(12);
    expect(melodyShift([{ tick: 0, dur: 480, midi: 67 }], 0)).toBe(0);
    // With a capo the shape sits lower, so the same sung note needs less lift.
    expect(melodyShift([{ tick: 0, dur: 480, midi: 58 }], 3)).toBe(12);
  });

  it('plays a note the shape already holds where the shape holds it', () => {
    // C shape: middle C on the B string, fret 1 (the line's middle is E, so no octave shift)
    const line = [60, 64, 67].map((midi, i) => ({ tick: i * 480, dur: 480, midi }));
    const [n] = placeMelody(line, [span('C', 0, 1440)], 0, 'moderate');
    expect(n).toMatchObject({ string: 4, fret: 1, melody: true });
  });

  it('stays near the hand position, on the top strings', () => {
    // C D E F G in first position: B1 B3 e0 e1 e3
    const line = [60, 62, 64, 65, 67].map((midi, i) => ({ tick: i * 480, dur: 480, midi }));
    const notes = placeMelody(line, [span('C', 0, 2400)], 0, 'moderate');
    expect(notes.every((n) => n.string >= 2 && n.fret <= 4)).toBe(true);
    expect(notes.map((n) => OPEN_MIDI[n.string] + n.fret)).toEqual([60, 62, 64, 65, 67]);
  });

  it('slurs a step on the same string at Moderate, not at Basic', () => {
    // E (64) then F# (66) on the open e string: hammer from 0 to 2
    const line = [
      { tick: 0, dur: 240, midi: 64 },
      { tick: 240, dur: 240, midi: 66 },
    ];
    expect(placeMelody(line, [span('Em')], 0, 'moderate').map((n) => n.tech)).toEqual([undefined, 'hammer']);
    expect(placeMelody(line, [span('Em')], 0, 'basic').map((n) => n.tech)).toEqual([undefined, undefined]);
  });
});

describe('mergeMelody', () => {
  const mel = (tick: number, dur: number, string: number, fret: number): NoteEvent => ({ tick, dur, string, fret, finger: 'a', velocity: 0.9, melody: true });
  const pat = (tick: number, string: number, fret: number, finger: NoteEvent['finger'] = 'i'): NoteEvent => ({ tick, dur: 240, string, fret, finger, velocity: 0.8 });

  it('clears the melody string and anything just under the tune, but keeps the bass and the harmony', () => {
    // Melody: G on the e string (fret 3) over C. Pattern: the bass, B-string F (2 under G: masks it),
    // G-string G (an octave under: harmony) and the open e string (the tune's string)
    const out = mergeMelody([pat(0, 1, 3, 'p'), pat(240, 4, 6), pat(240, 3, 0), pat(240, 5, 0)], [mel(0, 480, 5, 3)], [span('C')]);
    expect(out.map(({ tick, string, fret }) => [tick, string, fret])).toEqual([
      [0, 1, 3],
      [0, 5, 3],
      [240, 3, 0],
    ]);
  });

  it('drops pattern notes the hand can’t hold with the tune', () => {
    // Melody high on the e string (fret 8) over a first-position C: the fretted pattern notes go
    const out = mergeMelody([pat(0, 1, 3, 'p'), pat(0, 3, 0), pat(0, 2, 2)], [mel(0, 480, 5, 8)], [span('C')]);
    expect(isPlayable(out.filter((n) => n.tick === 0), span('C').voicing)).toBe(true);
    expect(out.some((n) => n.melody)).toBe(true);
    expect(out.some((n) => n.string === 3 && n.fret === 0)).toBe(true);
  });
});

describe('arrange with a melody', () => {
  const base = progression('C | G | Am | F');
  const sung: MelodyNote[] = [67, 69, 71, 72, 71, 69, 67, 64].map((midi, i) => note(i * 0.5 + base.beatTimesSec[0], 0.45, midi));
  const withTune: AnalysisResult = { ...base, melody: sung };

  it('puts the tune on top at every level and keeps every moment playable', () => {
    for (const level of ['basic', 'moderate', 'advanced'] as const) {
      for (const style of ['arpeggio', 'fingerstyle', 'flamenco'] as const) {
        const a = arrange(withTune, { style, level });
        const tune = a.events.filter((e) => e.melody);
        expect(tune.length).toBeGreaterThan(0);
        for (const m of tune) {
          const mark = [...a.chordMarks].reverse().find((c) => c.tick <= m.tick) ?? a.chordMarks[0];
          expect(isPlayable(a.events.filter((e) => e.tick === m.tick), mark.voicing)).toBe(true);
        }
      }
    }
  });

  it('can leave the tune out', () => {
    const plain = arrange(base, { style: 'fingerstyle', level: 'moderate' });
    expect(arrange(withTune, { style: 'fingerstyle', level: 'moderate', melody: false }).events).toEqual(plain.events);
  });

  it('plays the sung pitches (moved by octaves only)', () => {
    const a = arrange(withTune, { style: 'fingerstyle', level: 'moderate' });
    const heard = a.events.filter((e) => e.melody).map((e) => (OPEN_MIDI[e.string] + e.fret + a.capo) % 12);
    expect(heard).toEqual(sung.map((n) => n.midi % 12));
  });
});
