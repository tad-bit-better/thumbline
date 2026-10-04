import { arrange, meetsRequirements, patternCandidates, renderSpan } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { LEVELS, PATTERNS } from './patterns/index.js';
import { type ChordSpan, isPlayable } from './runner.js';
import { asciiTab } from './testing/ascii-tab.js';
import { PROGRESSIONS, progression } from './testing/progression.js';
import type { Level, PatternDef, Style, Voicing } from './types.js';

const STYLES: Style[] = ['arpeggio', 'fingerstyle'];

describe('arrange snapshots', () => {
  describe.each(PROGRESSIONS.map((p) => [p.name, p]))('%s', (_name, p) => {
    it.each(STYLES.flatMap((s) => LEVELS.map((l) => [s, l] as [Style, Level])))('%s %s', (style, level) => {
      const a = arrange(progression(p.chart, p.beatsPerBar), { style, level });
      expect(asciiTab(a)).toMatchSnapshot();
    });
  });
});

describe('arrange', () => {
  it('describes the song', () => {
    const a = arrange(progression('G | D | Em | C', 4, 84), { style: 'arpeggio', level: 'basic' });
    expect(a).toMatchObject({
      style: 'arpeggio',
      level: 'basic',
      patternId: 'arpeggio.basic.let-ring',
      capo: 0,
      meter: { beatsPerBar: 4 },
      bpm: 84,
      bars: 4,
    });
    expect(a.chordMarks.map((m) => [m.tick, m.voicing.name, m.soundingName])).toEqual([
      [0, 'G', 'G'],
      [1920, 'D', 'D'],
      [3840, 'Em', 'Em'],
      [5760, 'C', 'C'],
    ]);
  });

  it('chooses the capo automatically and names the sounding chords', () => {
    const a = arrange(progression('F# | D#m | B | C#'), { style: 'arpeggio', level: 'moderate' });
    expect(a.capo).toBe(4);
    expect(a.chordMarks.map((m) => [m.voicing.name, m.soundingName])).toEqual([
      ['D', 'F#'],
      ['Bm', 'Ebm'],
      ['G', 'B'],
      ['A', 'C#'],
    ]);
  });

  it('respects a fixed capo', () => {
    const a = arrange(progression('A | E'), { style: 'arpeggio', level: 'basic', capo: 2 });
    expect(a.capo).toBe(2);
    expect(a.chordMarks.map((m) => m.voicing.name)).toEqual(['G', 'D']);
  });

  it.each([-1, 13, 1.5])('rejects capo %s', (capo) => {
    expect(() => arrange(progression('A'), { style: 'arpeggio', level: 'basic', capo })).toThrow(/Capo/);
  });

  it('sorts events by tick, then string, and keeps them inside the song', () => {
    const a = arrange(progression('C | Am F | Dm7 G'), { style: 'fingerstyle', level: 'advanced' });
    const end = a.bars * 4 * TICKS_PER_BEAT;
    for (let i = 1; i < a.events.length; i++) {
      const [p, n] = [a.events[i - 1], a.events[i]];
      expect(p.tick < n.tick || (p.tick === n.tick && p.string < n.string)).toBe(true);
    }
    for (const e of a.events) expect(e.tick + e.dur).toBeLessThanOrEqual(end);
  });

  it('leaves silent bars empty', () => {
    const a = arrange(progression('G | - | C'), { style: 'arpeggio', level: 'basic' });
    expect(a.events.some((e) => e.tick >= 1920 && e.tick < 3840)).toBe(false);
    expect(a.chordMarks).toHaveLength(2);
  });

  it('returns an empty arrangement for no chords', () => {
    const a = arrange(progression('G'), { style: 'arpeggio', level: 'basic' });
    const empty = arrange({ ...progression('G'), chords: [] }, { style: 'arpeggio', level: 'basic' });
    expect(a.events.length).toBeGreaterThan(0);
    expect(empty).toMatchObject({ bars: 0, events: [], chordMarks: [], capo: 0 });
  });

  it('skips a chord that has no length', () => {
    const input = progression('G | C');
    input.chords.splice(1, 0, { ...input.chords[1], bar: 1, beat: 0, chord: { pc: 2, quality: 'maj' } });
    const a = arrange(input, { style: 'arpeggio', level: 'basic' });
    expect(a.chordMarks.map((m) => m.voicing.name)).toEqual(['G', 'C']);
  });

  describe('warnings', () => {
    it('explains Basic substitutions once per chord', () => {
      const a = arrange(progression('C | F | C | F'), { style: 'arpeggio', level: 'basic', capo: 0 });
      expect(a.warnings).toEqual([
        { code: 'simplified', message: 'Swapped F for Fmaj7 so you can skip the barre.' },
      ]);
    });

    it('flags barre chords above Basic', () => {
      const a = arrange(progression('C | F'), { style: 'arpeggio', level: 'moderate', capo: 0 });
      expect(a.warnings).toEqual([{ code: 'barre', message: 'F needs a barre at this capo position.' }]);
    });

    it('flags slash chords played without their bass', () => {
      const a = arrange(progression('E/G# | A'), { style: 'arpeggio', level: 'moderate', capo: 0 });
      expect(a.warnings).toContainEqual({
        code: 'slash-dropped',
        message: 'Playing E/G# without the separate bass note.',
      });
    });

    it('flags chords played as a different quality', () => {
      const a = arrange(progression('Badd9'), { style: 'arpeggio', level: 'moderate', capo: 0 });
      expect(a.warnings).toContainEqual({ code: 'unsupported-chord', message: 'Playing Badd9 as B.' });
    });
  });

  describe('every pattern on every progression', () => {
    const cases = PATTERNS.flatMap((pattern) =>
      PROGRESSIONS.filter((p) => pattern.meters.includes(p.beatsPerBar)).map(
        (p) => [pattern.id, p.name, pattern, p] as const,
      ),
    );

    it.each(cases)('%s on %s plays every chord and stays playable', (_id, _name, pattern, p) => {
      const a = arrange(progression(p.chart, p.beatsPerBar), {
        style: pattern.style,
        level: pattern.level,
        patternId: pattern.id,
      });
      expect(a.patternId).toBe(pattern.id);
      for (const mark of a.chordMarks) {
        const atChord = a.events.filter((e) => e.tick === mark.tick);
        expect(atChord.some((e) => e.string === mark.voicing.rootString && e.finger === 'p')).toBe(true);
        expect(isPlayable(atChord, mark.voicing)).toBe(true);
      }
      for (const e of a.events) {
        expect(e.fret).toBeGreaterThanOrEqual(0);
        expect(e.fret).toBeLessThanOrEqual(12);
      }
    });
  });
});

describe('patternCandidates', () => {
  it('puts the chosen pattern first, then its level, then the levels below', () => {
    expect(patternCandidates('fingerstyle', 'advanced', 4, 'fingerstyle.advanced.syncopated').map((p) => p.id)).toEqual([
      'fingerstyle.advanced.syncopated',
      'fingerstyle.advanced.travis-hammer',
      'fingerstyle.moderate.travis-pinch',
      'fingerstyle.moderate.travis',
      'fingerstyle.moderate.boom-chick',
      'fingerstyle.basic.thumb-pluck',
      'fingerstyle.basic.thumb-pinch',
    ]);
  });

  it('defaults to the first pattern of the level', () => {
    expect(patternCandidates('arpeggio', 'basic', 3)[0].id).toBe('arpeggio.basic.let-ring');
  });

  it('rejects unknown or mismatched patterns', () => {
    expect(() => patternCandidates('arpeggio', 'basic', 4, 'nope')).toThrow(/Unknown pattern/);
    expect(() => patternCandidates('arpeggio', 'basic', 4, 'fingerstyle.basic.thumb-pluck')).toThrow(
      /not a arpeggio basic/,
    );
    expect(() => patternCandidates('arpeggio', 'basic', 12, 'arpeggio.basic.roll')).toThrow(/12-beat/);
  });

  it('fails clearly for styles and meters without patterns yet', () => {
    expect(() => patternCandidates('flamenco', 'basic', 4)).toThrow(/No flamenco basic pattern/);
    expect(() => patternCandidates('arpeggio', 'basic', 12)).toThrow(/12-beat/);
  });
});

describe('pattern fallback', () => {
  const voicing = (frets: Voicing['frets'], barre = false): Voicing => ({
    name: 'X',
    frets,
    rootString: frets.findIndex((f) => f >= 0),
    barre,
  });
  const span = (v: Voicing): ChordSpan => ({ start: 0, end: 1920, voicing: v, played: { pc: 0, quality: 'maj' } });
  const make = (id: string, target: 'all' | 'bass', requires?: PatternDef['requires']): PatternDef => ({
    id,
    name: id,
    hint: '',
    style: 'arpeggio',
    level: 'basic',
    meters: [4],
    anchor: 'bar',
    events: { 4: [{ tick: 0, dur: 480, finger: 'p', target }] },
    requires,
  });

  it('checks maxFret and openTreble requirements', () => {
    const c = voicing([-1, 3, 2, 0, 1, 0]);
    expect(meetsRequirements(make('a', 'all', { maxFret: 2 }), c)).toBe(false);
    expect(meetsRequirements(make('a', 'all', { maxFret: 3 }), c)).toBe(true);
    expect(meetsRequirements(make('a', 'all', { openTreble: true }), c)).toBe(true);
    expect(meetsRequirements(make('a', 'all', { openTreble: true }), voicing([3, 2, 0, 0, 0, 3]))).toBe(false);
  });

  it('skips patterns whose requirements fail', () => {
    const notes = renderSpan([make('a', 'all', { maxFret: 2 }), make('b', 'bass')], span(voicing([-1, 3, 2, 0, 1, 0])), 4);
    expect(notes).toHaveLength(1);
  });

  it('falls back when a pattern is unplayable on the shape', () => {
    const wide = voicing([1, -1, -1, -1, -1, 8]);
    expect(renderSpan([make('a', 'all'), make('b', 'bass')], span(wide), 4)).toHaveLength(1);
  });

  it('keeps the chosen pattern when nothing fits', () => {
    const wide = voicing([1, -1, -1, -1, -1, 8]);
    expect(renderSpan([make('a', 'all')], span(wide), 4)).toHaveLength(2);
  });
});
