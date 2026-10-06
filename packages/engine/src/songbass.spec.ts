import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { Level, NoteEvent } from './types.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const pcOf = (e: NoteEvent, capo: number) => (OPEN_MIDI[e.string] + e.fret + capo) % 12;
const BAR = 4 * TICKS_PER_BEAT;
// Don't Stop's move: Cm over an Ab sub-bass, then Bb.
const song = { ...progression('Cm/Ab | Bb | Cm/Ab | Bb'), key: { pc: 0, mode: 'minor' as const } };
const sheet = (level: Level) => arrange(song, { style: 'fingerstyle', level, capo: 0, melody: false });

describe('the song’s bass under a chord without a slash shape (M11b)', () => {
  it('the thumb plays the held bass note, not the chord’s root', () => {
    for (const level of ['basic', 'moderate', 'advanced'] as const) {
      const a = sheet(level);
      const thumbs = a.events.filter((e) => e.finger === 'p' && e.fret >= 0 && e.tick < BAR);
      const lowest = thumbs.filter((e) => e.tick === 0).sort((x, y) => x.string - y.string)[0];
      expect(pcOf(lowest, a.capo)).toBe(8);
      expect(thumbs.some((e) => pcOf(e, a.capo) === 0 && e.string < lowest.string)).toBe(false);
    }
  });

  it('keeps the moment playable and no longer warns that the bass was dropped', () => {
    const a = sheet('moderate');
    for (const t of new Set(a.events.filter((e) => e.tick < BAR).map((e) => e.tick))) {
      expect(isPlayable(a.events.filter((e) => e.tick === t), a.chordMarks[0].voicing)).toBe(true);
    }
    expect(a.warnings.some((w) => w.code === 'slash-dropped')).toBe(false);
  });

  it('leaves chords without a separate bass alone', () => {
    const a = sheet('moderate');
    const bb = a.events.filter((e) => e.tick === BAR && e.finger === 'p').sort((x, y) => x.string - y.string)[0];
    expect(pcOf(bb, a.capo)).toBe(10);
  });
});
