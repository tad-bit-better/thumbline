import { choiceFor, keyFor, toSectionSettings } from './section-settings';
import type { SongSection } from './sheet-view';

const A1: SongSection = { id: '0', title: 'Section A', letter: 'A', firstBar: 0, bars: 8 };
const B: SongSection = { id: '8', title: 'Section B', letter: 'B', firstBar: 8, bars: 8 };
const A2: SongSection = { id: '16', title: 'Section A', letter: 'A', firstBar: 16, bars: 8 };
const PART: SongSection = { id: '0', title: 'Part 1', firstBar: 0, bars: 8 };

describe('section settings', () => {
  it('keys a choice by letter (every repeat), or by bar for one section', () => {
    expect(keyFor(A2, false)).toBe('letter:A');
    expect(keyFor(A2, true)).toBe('bar:16');
    // Sections that don't repeat have no letter: always their own.
    expect(keyFor(PART, false)).toBe('bar:0');
  });

  it('finds a section\'s choice: its own first, then its letter\'s', () => {
    const stored = { 'letter:A': { fullness: 8 }, 'bar:16': { patternId: 'p2' } };
    expect(choiceFor(A1, stored)).toEqual({ key: 'letter:A', onlyThis: false, choice: { fullness: 8 } });
    expect(choiceFor(A2, stored)).toEqual({ key: 'bar:16', onlyThis: true, choice: { patternId: 'p2' } });
    expect(choiceFor(B, stored)).toEqual({ key: 'letter:B', onlyThis: false, choice: undefined });
  });

  it('turns the choices into the engine\'s section settings', () => {
    const stored = { 'letter:A': { fullness: 8 }, 'bar:16': { patternId: 'p2' } };
    expect(toSectionSettings([A1, B, A2], stored)).toEqual([
      { fromBar: 0, toBar: 8, fullness: 8 },
      { fromBar: 16, toBar: 24, patternId: 'p2' },
    ]);
    expect(toSectionSettings([A1, B, A2], undefined)).toEqual([]);
  });
});
