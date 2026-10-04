import { chordTones, parseChord } from './chords.js';
import { OPEN_PC } from './constants.js';
import type { ChordLabel, Frets, Level, Quality } from './types.js';
import {
  LIBRARY,
  fretSpan,
  getVoicing,
  movableVoicing,
  rootStringOf,
  soundedPcs,
} from './voicings.js';

const label = (token: string): ChordLabel => {
  const parsed = parseChord(token);
  if (!parsed) throw new Error(`bad chord ${token}`);
  return parsed.label;
};

const lowestSounded = (frets: Frets) => frets.findIndex((f) => f >= 0);

function expectPlayableShapeOf(frets: Frets, chord: ChordLabel, barre: boolean) {
  const tones = chordTones(chord);
  const pcs = soundedPcs(frets);
  for (const pc of pcs) expect(tones.has(pc)).toBe(true);
  expect(pcs.has(chord.pc)).toBe(true);
  const lowest = lowestSounded(frets);
  if (chord.bassPc !== undefined) {
    expect((OPEN_PC[lowest] + frets[lowest]) % 12).toBe(chord.bassPc);
  }
  expect(fretSpan(frets)).toBeLessThanOrEqual(4);
  if (!barre) expect(frets.filter((f) => f > 0).length).toBeLessThanOrEqual(4);
}

describe('LIBRARY', () => {
  it.each(LIBRARY.map((e) => [e.name, e]))(
    '%s sounds only its chord tones, includes the root and is playable',
    (_name, entry) => {
      expectPlayableShapeOf(entry.frets, label(entry.name), entry.barre);
    },
  );

  it('has no duplicate chords', () => {
    const names = LIBRARY.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('movableVoicing', () => {
  const qualities: Quality[] = ['maj', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'dim', '6'];

  it.each(qualities)('builds a valid %s shape on every root', (quality) => {
    for (let pc = 0; pc < 12; pc++) {
      const { frets, barre } = movableVoicing({ pc, quality });
      expectPlayableShapeOf(frets, { pc, quality }, barre);
    }
  });

  it('picks the shape with the lowest root fret', () => {
    // C: A-shape root at fret 3 beats E-shape at fret 8
    expect(movableVoicing({ pc: 0, quality: 'm' }).frets).toEqual([-1, 3, 5, 5, 4, 3]);
    // G#: E-shape root at fret 4 beats A-shape at fret 11
    expect(movableVoicing({ pc: 8, quality: 'maj' }).frets).toEqual([4, 6, 6, 5, 4, 4]);
  });

  it('marks shapes above the nut as barre and open-position shapes as not', () => {
    expect(movableVoicing({ pc: 10, quality: 'maj' }).barre).toBe(true);
    expect(movableVoicing({ pc: 9, quality: 'maj' }).barre).toBe(false);
  });

  it('falls back to a major shape for qualities without a movable shape', () => {
    const v = movableVoicing({ pc: 11, quality: 'add9' });
    expect(v.quality).toBe('maj');
    expect(v.name).toBe('B');
  });
});

describe('rootStringOf', () => {
  it.each([
    ['C', 1],
    ['G', 0],
    ['D', 2],
    ['Am', 1],
    ['E', 0],
    ['Fmaj7', 2],
    ['Gsus4', 0],
    ['G/B', 1],
    ['D/F#', 0],
    ['C/G', 0],
  ])('%s → string %i', (name, string) => {
    const entry = LIBRARY.find((e) => e.name === name);
    if (!entry) throw new Error(name);
    expect(rootStringOf(entry.frets, label(name))).toBe(string);
  });
});

describe('getVoicing', () => {
  const get = (token: string, level: Level = 'moderate') => getVoicing(label(token), level);

  it('uses the library slash chord when there is one', () => {
    const r = get('G/B');
    expect(r.voicing.name).toBe('G/B');
    expect(r.voicing.frets).toEqual([-1, 2, 0, 0, 0, 3]);
    expect(r.voicing.rootString).toBe(1);
    expect(r.slashDropped).toBe(false);
  });

  it('drops the slash bass when the library has no such shape', () => {
    const r = get('E/G#');
    expect(r.voicing.name).toBe('E');
    expect(r.slashDropped).toBe(true);
    expect(r.played).toEqual({ pc: 4, quality: 'maj' });
  });

  it('uses the plain library chord', () => {
    const r = get('Am7');
    expect(r.voicing).toEqual({
      name: 'Am7',
      frets: [-1, 0, 2, 0, 1, 0],
      rootString: 1,
      barre: false,
    });
  });

  it('keeps barre chords above Basic', () => {
    expect(get('F').voicing).toMatchObject({ name: 'F', barre: true });
    expect(get('Bm', 'advanced').voicing).toMatchObject({ name: 'Bm', barre: true });
  });

  it.each([
    ['F', 'Fmaj7'],
    ['Bm', 'Bm7'],
    ['B', 'B7'],
  ])('Basic swaps %s for %s', (from, to) => {
    const r = get(from, 'basic');
    expect(r.voicing.name).toBe(to);
    expect(r.voicing.barre).toBe(false);
    expect(r.voicing.simplified).toEqual({ from });
    expect(r.played).toEqual(label(to));
  });

  it('Basic keeps an open library chord as is', () => {
    expect(get('G', 'basic').voicing.simplified).toBeUndefined();
  });

  it('Basic falls back to the barre shape when no simpler open chord exists', () => {
    const r = get('Cm', 'basic');
    expect(r.voicing.frets).toEqual([-1, 3, 5, 5, 4, 3]);
    expect(r.voicing.barre).toBe(true);
    expect(r.voicing.simplified).toBeUndefined();
  });

  it('builds a movable shape for chords outside the library', () => {
    const r = get('Bb');
    expect(r.voicing).toEqual({
      name: 'Bb',
      frets: [-1, 1, 3, 3, 3, 1],
      rootString: 1,
      barre: true,
    });
    expect(r.unsupported).toBe(false);
  });

  it('flags chords it has to play as a different quality', () => {
    const r = get('Badd9');
    expect(r.voicing.name).toBe('B');
    expect(r.unsupported).toBe(true);
    expect(r.played).toEqual({ pc: 11, quality: 'maj' });
  });
});
