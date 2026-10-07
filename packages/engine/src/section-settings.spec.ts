import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { patternsFor } from './patterns/index.js';
import { isPlayable } from './runner.js';
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

  describe('a section without a tune', () => {
    // The tune sings in the verse only; the chorus (bars 8–15) is instrumental.
    const half: AnalysisResult = { ...song, melody: song.melody?.filter((n) => n.startSec < 8 * 4 * BEAT_SEC) };
    const at = (sectionSettings?: Parameters<typeof arrange>[1]['sectionSettings'], level: 'moderate' | 'advanced' = 'moderate') =>
      arrange(half, { style: 'fingerstyle', level, capo: 0, patternId: patternsFor('fingerstyle', level, 4)[0].id, sectionSettings });
    const topFrets = (a: Arrangement, from: number, to: number) => new Set(inBars(a, from, to).filter((e) => e.string >= 4 && e.finger !== 'p').map((e) => `${e.string}/${e.fret}`));

    it('stays as it was at the song\'s fullness', () => {
      expect(count(at(), 8, 16, 'fill')).toBe(0);
    });

    it('gets runs into its chord changes and a moving top line when fuller', () => {
      const plain = at();
      const full = at([{ fromBar: 8, toBar: 16, fullness: 8 }]);
      expect(count(full, 8, 16, 'fill')).toBeGreaterThan(0);
      expect(topFrets(full, 8, 16).size).toBeGreaterThan(topFrets(plain, 8, 16).size);
      // Runs fill the time before a change; they don't speed up the rhythm.
      expect(inBars(full, 8, 16).every((e) => e.tick % (BEAT / 4) === 0)).toBe(true);
      expect(inBars(full, 0, 7)).toEqual(inBars(plain, 0, 7));
    });

    it('stays playable', () => {
      const a = at([{ fromBar: 8, toBar: 16, fullness: 10 }], 'advanced');
      const byTick = new Map<number, typeof a.events>();
      for (const e of a.events) byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), e]);
      for (const [tick, notes] of byTick) {
        const mark = [...a.chordMarks].reverse().find((m) => m.tick <= tick);
        if (mark) expect(isPlayable(notes, mark.voicing)).toBe(true);
      }
    });
  });
});
