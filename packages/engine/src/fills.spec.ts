import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, Arrangement, Level, MelodyNote, NoteEvent } from './types.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;
const BEAT = TICKS_PER_BEAT;
const BAR = 4 * BEAT;
const BEAT_SEC = 60 / 90;
const note = (beat: number, beats: number, midi: number): MelodyNote => ({ startSec: beat * BEAT_SEC, durSec: beats * BEAT_SEC * 0.95, midi, confidence: 0.9 });
const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

// C major: the tune sings on beat 1 of each bar and rests for the other three beats.
const song: AnalysisResult = {
  ...progression('C | Am | F | G | C | Am | F | C'),
  melody: [72, 76, 77, 74, 72, 76, 77, 72].map((midi, bar) => note(bar * 4, 1, midi)),
};
const sheet = (level: Level, style: 'fingerstyle' | 'arpeggio' | 'flamenco' = 'fingerstyle') => arrange(song, { style, level, capo: 0 });
const fillsIn = (a: Arrangement, from: number, to: number) => a.events.filter((e) => e.fill && e.tick >= from && e.tick < to);

describe('fills where the tune rests (M11)', () => {
  it('Moderate: eighth notes in the beat before the next tune note, stepping in the key toward it', () => {
    const a = sheet('moderate');
    for (let bar = 1; bar < 8; bar++) {
      const next = a.events.find((e) => e.melody && e.tick === bar * BAR) as NoteEvent;
      const fill = fillsIn(a, bar * BAR - BEAT, bar * BAR);
      expect(fill.map((e) => e.tick - (bar * BAR - BEAT))).toEqual([0, BEAT / 2]);
      expect(fill.every((e) => C_MAJOR.has(midiOf(e) % 12))).toBe(true);
      expect(Math.abs(midiOf(next) - midiOf(fill[1]))).toBeLessThanOrEqual(2);
      expect(Math.abs(midiOf(fill[1]) - midiOf(fill[0]))).toBeLessThanOrEqual(2);
    }
  });

  it('Advanced: sixteenths over the last two beats, with slurs', () => {
    const a = sheet('advanced');
    const fill = fillsIn(a, 2 * BEAT, BAR);
    expect(fill.length).toBeGreaterThanOrEqual(5);
    expect(fill.some((e, i) => i > 0 && e.tick - fill[i - 1].tick === TICKS_PER_BEAT / 4)).toBe(true);
    expect(fill.some((e) => e.tech === 'hammer' || e.tech === 'pull')).toBe(true);
  });

  it('keeps the thumb’s bass under the fill and stays within reach', () => {
    const a = sheet('advanced');
    expect(a.events.some((e) => e.finger === 'p' && e.tick >= 2 * BEAT && e.tick < BAR)).toBe(true);
    for (const t of new Set(a.events.filter((e) => e.fill).map((e) => e.tick))) {
      const voicing = a.chordMarks.filter((m) => m.tick <= t).at(-1)!.voicing;
      expect(isPlayable(a.events.filter((e) => e.tick === t), voicing)).toBe(true);
    }
  });

  it('does not fill a short breath', () => {
    const tight = { ...song, melody: [72, 74, 76, 77].flatMap((midi, i) => [note(i * 2, 1.7, midi)]) };
    expect(arrange(tight, { style: 'fingerstyle', level: 'moderate', capo: 0 }).events.some((e) => e.fill)).toBe(false);
  });

  it('Basic and flamenco play no fills', () => {
    expect(sheet('basic').events.some((e) => e.fill)).toBe(false);
    expect(sheet('moderate', 'flamenco').events.some((e) => e.fill)).toBe(false);
  });

  it('fills arpeggio sheets too', () => {
    expect(sheet('moderate', 'arpeggio').events.some((e) => e.fill)).toBe(true);
  });
});
