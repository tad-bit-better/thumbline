import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { Arrangement, Level, NoteEvent, Voicing } from './types.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;
const BEAT = TICKS_PER_BEAT;
const BAR = 4 * BEAT;
const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const sheet = (chart: string, level: Level, style: 'fingerstyle' | 'arpeggio' | 'flamenco' = 'fingerstyle') =>
  arrange(progression(chart), { style, level, capo: 0, melody: false });
const walkIn = (a: Arrangement, from: number, to: number) => a.events.filter((e) => e.walk && e.tick >= from && e.tick < to);

describe('a bass that walks into the next chord (M11)', () => {
  it('Moderate: C to Am steps down through B on the last beat', () => {
    const [w] = walkIn(sheet('C | Am | F | G', 'moderate'), 0, BAR);
    expect(w).toMatchObject({ tick: BAR - BEAT, finger: 'p' });
    expect(midiOf(w)).toBe(47); // B, between C (48) and A (45)
  });

  it('Moderate: G to C walks up through B', () => {
    const [w] = walkIn(sheet('C | Am | F | G | C', 'moderate'), 3 * BAR, 4 * BAR);
    expect(midiOf(w)).toBe(47);
  });

  it('Advanced: two eighths lead in, in the key', () => {
    const w = walkIn(sheet('C | Am | F | G | C', 'advanced'), 3 * BAR, 4 * BAR);
    expect(w.map((e) => e.tick)).toEqual([4 * BAR - BEAT, 4 * BAR - BEAT / 2]);
    expect(w.map(midiOf)).toEqual([45, 47]); // A, B into C
    expect(w.every((e) => C_MAJOR.has(midiOf(e) % 12))).toBe(true);
  });

  it('skips chords a step apart or the same bass, and short chords', () => {
    expect(walkIn(sheet('C | C | C | C', 'moderate'), 0, 4 * BAR)).toEqual([]);
    expect(walkIn(sheet('C G | Am', 'moderate'), 0, BAR)).toEqual([]);
  });

  it('stays within reach of the shape it leaves', () => {
    for (const level of ['moderate', 'advanced'] as const) {
      const a = sheet('C | Am | F | G | C | Em | Dm | G | C', level);
      for (const w of a.events.filter((e) => e.walk)) {
        const voicing = a.chordMarks.filter((m) => m.tick <= w.tick).at(-1)?.voicing as Voicing;
        expect(isPlayable(a.events.filter((e) => e.tick === w.tick), voicing)).toBe(true);
      }
    }
  });

  it('Basic and flamenco keep their bass', () => {
    expect(sheet('C | Am | F | G | C', 'basic').events.some((e) => e.walk)).toBe(false);
    expect(sheet('Am | G | F | E', 'moderate', 'flamenco').events.some((e) => e.walk)).toBe(false);
  });

  it('walks in arpeggio sheets too', () => {
    expect(sheet('C | Am | F | G | C', 'moderate', 'arpeggio').events.some((e) => e.walk)).toBe(true);
  });
});
