import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { patternsFor } from './patterns/index.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, Arrangement, MelodyNote } from './types.js';

const BEAT = TICKS_PER_BEAT;
const BAR = 4 * BEAT;
const BEAT_SEC = 60 / 90;
const note = (beat: number, beats: number, midi: number): MelodyNote => ({ startSec: beat * BEAT_SEC, durSec: beats * BEAT_SEC * 0.95, midi, confidence: 0.9 });

// 16 bars: a verse (bars 0–7) and a chorus (8–15), a tune note on beats 1 and 2 of each bar.
const song: AnalysisResult = {
  ...progression('C | Am | F | G | C | Am | F | C | F | G | C | Am | F | G | C | C'),
  melody: Array.from({ length: 16 }, (_, bar) => [note(bar * 4, 1, 72 + (bar % 3)), note(bar * 4 + 1, 0.5, 71)]).flat(),
};
const sheet = (sectionSettings?: Parameters<typeof arrange>[1]['sectionSettings']) =>
  arrange(song, { style: 'fingerstyle', level: 'moderate', capo: 0, patternId: patternsFor('fingerstyle', 'moderate', 4)[0].id, sectionSettings });
const inBars = (a: Arrangement, from: number, to: number) => a.events.filter((e) => e.tick >= from * BAR && e.tick < to * BAR);
const count = (a: Arrangement, from: number, to: number, kind: 'fill' | 'harmony') => inBars(a, from, to).filter((e) => e[kind]).length;

describe('section settings (pattern and fullness per section)', () => {
  it('plays as before without them', () => {
    expect(sheet([]).events).toEqual(sheet().events);
  });

  it('plays a section\'s own pattern in its bars only', () => {
    const [main, other] = patternsFor('fingerstyle', 'moderate', 4);
    const a = sheet([{ fromBar: 8, toBar: 16, patternId: other.id }]);
    expect(a.patternChanges).toEqual([
      { bar: 0, patternId: main.id },
      { bar: 8, patternId: other.id },
    ]);
    expect(inBars(a, 0, 7)).toEqual(inBars(sheet(), 0, 7));
    expect(inBars(a, 9, 16)).not.toEqual(inBars(sheet(), 9, 16));
  });

  it('fills a section in more without touching the rest', () => {
    const plain = sheet();
    const full = sheet([{ fromBar: 8, toBar: 16, fullness: 10 }]);
    expect(count(full, 9, 16, 'harmony')).toBeGreaterThan(count(plain, 9, 16, 'harmony'));
    expect(inBars(full, 0, 7)).toEqual(inBars(plain, 0, 7));
    const sparse = sheet([{ fromBar: 0, toBar: 8, fullness: 1 }]);
    expect(count(sparse, 0, 7, 'fill') + count(sparse, 0, 7, 'harmony')).toBe(0);
    expect(inBars(sparse, 9, 16)).toEqual(inBars(plain, 9, 16));
  });

  it('ignores a saved pattern that isn\'t for this style and level, and checks fullness', () => {
    expect(sheet([{ fromBar: 0, toBar: 8, patternId: 'arpeggio.basic.travis' }]).events).toEqual(sheet().events);
    expect(sheet([{ fromBar: 0, toBar: 8, patternId: 'no.such.pattern' }]).events).toEqual(sheet().events);
    expect(() => sheet([{ fromBar: 0, toBar: 8, fullness: 11 }])).toThrow(/1 to 10/);
  });
});
