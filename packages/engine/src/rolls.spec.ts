import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { progression } from './testing/progression.js';
import type { Arrangement } from './types.js';

const BAR = 4 * TICKS_PER_BEAT;
const song = (mood: { energy: number; valence: number }) => ({ ...progression('C | C | Am | Am | F | F | G | G | C | C | Am | Am | F | F | G | C'), mood });
const CALM = { energy: 0.3, valence: 0.7 };
const DRIVING = { energy: 0.8, valence: 0.7 };
const rollAt = (a: Arrangement, tick: number) => a.events.filter((e) => e.tick === tick && e.tech === 'brush-down');

describe('rolls (M11)', () => {
  it('opens each four-bar phrase of a calm song with a slow roll across the whole shape', () => {
    const a = arrange(song(CALM), { style: 'fingerstyle', level: 'moderate', melody: false });
    for (const bar of [0, 4, 8, 12]) {
      const roll = rollAt(a, bar * BAR);
      expect(roll.length).toBeGreaterThanOrEqual(4);
      expect(roll.every((e) => e.finger === 'p')).toBe(true);
      expect(new Set(roll.map((e) => e.string)).size).toBe(roll.length);
    }
    expect(rollAt(a, 2 * BAR)).toEqual([]);
  });

  it('rolls every other phrase when the song drives', () => {
    const a = arrange(song(DRIVING), { style: 'fingerstyle', level: 'moderate', melody: false });
    expect(rollAt(a, 0).length).toBeGreaterThan(0);
    expect(rollAt(a, 4 * BAR)).toEqual([]);
    expect(rollAt(a, 8 * BAR).length).toBeGreaterThan(0);
  });

  it('lets the last chord ring as a roll', () => {
    const a = arrange(song(DRIVING), { style: 'arpeggio', level: 'basic', melody: false });
    const last = rollAt(a, 15 * BAR);
    expect(last.length).toBeGreaterThanOrEqual(4);
    expect(last.every((e) => e.dur >= BAR)).toBe(true);
  });

  it('replaces the plucks on that beat instead of doubling them', () => {
    const a = arrange(song(CALM), { style: 'fingerstyle', level: 'moderate', melody: false });
    const atZero = a.events.filter((e) => e.tick === 0 && e.fret >= 0);
    expect(atZero.every((e) => e.tech === 'brush-down')).toBe(true);
  });

  it('leaves flamenco to its own strums', () => {
    const a = arrange(song(CALM), { style: 'flamenco', level: 'moderate', melody: false });
    expect(a.events.some((e) => e.tech === 'brush-down')).toBe(false);
  });

  it('rolls on clips analysed before moods too (as a calm song)', () => {
    const a = arrange(progression('C | C | Am | Am | F | F | G | C'), { style: 'fingerstyle', level: 'basic', melody: false });
    expect(rollAt(a, 0).length).toBeGreaterThan(0);
  });
});
