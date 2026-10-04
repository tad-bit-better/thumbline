import { arrange } from './arrange.js';
import { applySections, applyTouch, moodLabelOf, sectionsOf } from './mood.js';
import { progression } from './testing/progression.js';
import type { NoteEvent } from './types.js';

const n = (tick: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({ tick, dur: 960, string: 3, fret: 0, finger: 'i', velocity: 0.8, ...extra });

describe('moodLabelOf', () => {
  it('names the quadrant of energy and valence', () => {
    expect(moodLabelOf({ energy: 0.2, valence: 0.2 })).toBe('melancholic');
    expect(moodLabelOf({ energy: 0.2, valence: 0.8 })).toBe('warm');
    expect(moodLabelOf({ energy: 0.8, valence: 0.2 })).toBe('intense');
    expect(moodLabelOf({ energy: 0.8, valence: 0.8 })).toBe('upbeat');
  });
});

describe('applyTouch', () => {
  it('plays a melancholic song softer, accenting only the bar’s first beat, and lets notes ring', () => {
    const e = [n(0, { accent: true }), n(480, { accent: true })];
    applyTouch(e, 'melancholic', 4);
    expect(e.map((x) => [x.velocity, x.accent, x.dur])).toEqual([
      [0.68, true, 960],
      [0.68, undefined, 960],
    ]);
  });

  it('cuts an upbeat song’s pattern notes short so it bounces, but leaves the tune alone', () => {
    const e = [n(0), n(0, { finger: 'p', string: 0 }), n(240, { melody: true, string: 5 })];
    applyTouch(e, 'upbeat', 4);
    expect(e.map((x) => x.dur)).toEqual([240, 240, 960]);
    expect(e[2].velocity).toBe(0.8);
  });
});

describe('sectionsOf', () => {
  // 16 bars of 4/4: quiet verse (bars 0–7), loud chorus (8–15)
  const beatEnergy = [...Array(32).fill(0.3), ...Array(32).fill(0.95)];

  it('finds quiet and loud phrases', () => {
    const s = sectionsOf({ beatEnergy, barStartBeat: 0 }, 4, 16);
    expect(s.slice(0, 8).every((x) => x === 'soft')).toBe(true);
    expect(s.slice(8).every((x) => x === 'full')).toBe(true);
  });

  it('keeps a song without much contrast normal throughout', () => {
    const flat = sectionsOf({ beatEnergy: Array(64).fill(0.7), barStartBeat: 0 }, 4, 16);
    expect(new Set(flat)).toEqual(new Set(['normal']));
  });

  it('is normal everywhere without loudness data', () => {
    expect(sectionsOf({ barStartBeat: 0 }, 4, 3)).toEqual(['normal', 'normal', 'normal']);
  });
});

describe('applySections', () => {
  it('thins soft bars to the beat but keeps the bass and the tune; full bars play harder', () => {
    const e = [n(0), n(240), n(240, { finger: 'p', string: 0 }), n(360, { melody: true, string: 5 }), n(1920), n(2160)];
    const out = applySections(e, ['soft', 'full'], 4);
    expect(out.map((x) => x.tick)).toEqual([0, 240, 360, 1920, 2160]);
    expect(out[0].velocity).toBe(0.64);
    expect(out[3]).toMatchObject({ velocity: 0.88, accent: true });
  });
});

describe('arrange with a mood', () => {
  const base = progression('Am | F | C | G | Am | F | C | G');

  it('opens with the pattern that suits the mood', () => {
    expect(arrange({ ...base, mood: { energy: 0.2, valence: 0.1 } }, { style: 'fingerstyle', level: 'moderate' }).patternId).toBe('fingerstyle.moderate.ballad');
    expect(arrange({ ...base, mood: { energy: 0.9, valence: 0.9 } }, { style: 'fingerstyle', level: 'moderate' }).patternId).toBe('fingerstyle.moderate.travis-pinch');
  });

  it('lets the user override the mood and reports it', () => {
    const a = arrange({ ...base, mood: { energy: 0.2, valence: 0.1 } }, { style: 'fingerstyle', level: 'moderate', mood: 'upbeat' });
    expect(a.mood).toBe('upbeat');
    expect(a.patternId).toBe('fingerstyle.moderate.travis-pinch');
  });

  it('builds with the song: fewer notes in the quiet half', () => {
    const beatEnergy = [...Array(16).fill(0.3), ...Array(16).fill(0.95)];
    const a = arrange({ ...base, beatEnergy }, { style: 'fingerstyle', level: 'moderate' });
    expect(a.sections?.slice(0, 4)).toEqual(['soft', 'soft', 'soft', 'soft']);
    const quiet = a.events.filter((e) => e.tick < 4 * 1920).length;
    const loud = a.events.filter((e) => e.tick >= 4 * 1920).length;
    expect(quiet).toBeLessThan(loud);
  });

  it('changes nothing for songs analysed before moods', () => {
    const a = arrange(base, { style: 'arpeggio', level: 'moderate' });
    expect(a.mood).toBeUndefined();
    expect(a.sections).toBeUndefined();
  });
});
