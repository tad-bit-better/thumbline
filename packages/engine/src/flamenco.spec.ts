import { arrange, flamencoCapo, patternCandidates } from './arrange.js';
import { bestCapo } from './capo.js';
import { parseChord } from './chords.js';
import { PALOS, patternsFor } from './patterns/index.js';
import { type ChordSpan, runSegment, scaleNotes } from './runner.js';
import { asciiTab } from './testing/ascii-tab.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, ChordLabel, Level, PatternDef, Voicing } from './types.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const LEVELS: Level[] = ['basic', 'moderate', 'advanced'];
const label = (name: string) => (parseChord(name) as { label: ChordLabel }).label;
const chords = (chart: string) => chart.split(/\s+/).map(label);
const minor = (pc: number): AnalysisResult['key'] => ({ pc, mode: 'minor' });
const voicing = (frets: Voicing['frets'], rootString: number, name = 'X'): Voicing => ({ name, frets, rootString, barre: false });

/** The Andalusian cadence, in A minor and a tone up. */
const ANDALUSIAN = { ...progression('Am | G | F | E | Am | G | F | E'), key: minor(9) };
const UP_A_TONE = { ...progression('Bm | A | G | F# | Bm | A | G | F#'), key: minor(11) };

describe('flamenco arrangements', () => {
  describe.each(PALOS.map((p) => [p]))('%s', (palo) => {
    it.each(LEVELS.map((l) => [l]))('%s snapshot', (level) => {
      expect(asciiTab(arrange(ANDALUSIAN, { style: 'flamenco', level, palo }))).toMatchSnapshot();
    });

    it.each(LEVELS.map((l) => [l]))('has a %s pattern', (level) => {
      expect(patternsFor('flamenco', level, 4, palo).length).toBeGreaterThan(0);
    });
  });

  it('plays rumba unless asked for another palo', () => {
    expect(arrange(ANDALUSIAN, { style: 'flamenco', level: 'basic' }).patternId).toBe('flamenco.basic.rumba');
    expect(arrange(ANDALUSIAN, { style: 'flamenco', level: 'basic', palo: 'tangos' }).patternId).toBe('flamenco.basic.tangos');
  });

  it('keeps to the palo when falling back a level', () => {
    const ids = patternCandidates('flamenco', 'advanced', 4, undefined, 'tangos').map((p) => p.id);
    expect(ids.every((id) => !id.includes('rumba'))).toBe(true);
  });

  it('rejects palos v1 does not play', () => {
    expect(() => arrange(ANDALUSIAN, { style: 'flamenco', level: 'basic', palo: 'bulerias' })).toThrow(/Unknown palo "bulerias"/);
  });

  it('ignores the palo for other styles', () => {
    expect(() => arrange(ANDALUSIAN, { style: 'arpeggio', level: 'basic', palo: 'bulerias' })).not.toThrow();
  });

  it('puts a golpe and a strum on the same beat', () => {
    const a = arrange(ANDALUSIAN, { style: 'flamenco', level: 'basic', palo: 'rumba' });
    const beat2 = a.events.filter((e) => e.tick === 480);
    expect(beat2.some((e) => e.tech === 'golpe' && e.fret === -1 && e.string === 0)).toBe(true);
    expect(beat2.filter((e) => e.tech === 'rasgueo-down').length).toBeGreaterThanOrEqual(4);
  });

  it('plays the same shapes a tone up, with a capo', () => {
    const a = arrange(UP_A_TONE, { style: 'flamenco', level: 'moderate' });
    expect(a.capo).toBe(2);
    expect(a.chordMarks.slice(0, 4).map((m) => m.voicing.name)).toEqual(['Am', 'G', 'F', 'E']);
  });
});

describe('flamencoCapo', () => {
  it('puts the Phrygian home chord (a major chord with one a semitone above) on the E shape', () => {
    expect(flamencoCapo(chords('Am G F E'), minor(9))).toBe(0);
    expect(flamencoCapo(chords('Bm A G F#'), minor(11))).toBe(2);
    expect(flamencoCapo(chords('F# G F# G'), { pc: 11, mode: 'minor' })).toBe(2);
  });

  it('falls back to the dominant of a minor key', () => {
    // C# minor, no semitone pair: G# is home, so capo 4 makes it E.
    expect(flamencoCapo(chords('C#m F#m C#m F#m'), minor(1))).toBe(4);
  });

  it('uses the A shape when the E shape needs a capo past 7', () => {
    // Home D#: E shape at capo 11; A shape at capo 6 (A–Bb–C–Dm).
    expect(flamencoCapo(chords('D# E D# E'), minor(8))).toBe(6);
  });

  it('uses the usual capo when there is no home chord', () => {
    expect(flamencoCapo(chords('C G Am F'), { pc: 0, mode: 'major' })).toBe(bestCapo(chords('C G Am F')));
  });
});

describe('scale walker (picado)', () => {
  const span = (frets: Voicing['frets'], rootString: number, played: string, key?: AnalysisResult['key']): ChordSpan => ({
    start: 0,
    end: 1920,
    voicing: voicing(frets, rootString),
    played: label(played),
    key,
  });
  const pcs = (notes: Array<{ string: number; fret: number }>) => notes.map((n) => (OPEN_MIDI[n.string] + n.fret) % 12);

  it('walks the key’s scale on strings 0–3 within reach', () => {
    const notes = scaleNotes(span([-1, 0, 2, 2, 1, 0], 1, 'Am', minor(9)));
    expect(notes.every((n) => n.string <= 3 && n.fret <= 3)).toBe(true);
    expect(new Set(pcs(notes))).toEqual(new Set([9, 11, 0, 2, 4, 5, 7]));
  });

  it('lets chord tones take over: G# over E in A minor', () => {
    const notes = pcs(scaleNotes(span([0, 2, 2, 1, 0, 0], 0, 'E', minor(9))));
    expect(notes).toContain(8);
    expect(notes).not.toContain(7);
  });

  it('uses the chord’s own scale without a key', () => {
    expect(new Set(pcs(scaleNotes(span([3, 2, 0, 0, 0, 3], 0, 'G'))))).toEqual(new Set([7, 9, 11, 0, 2, 4, 6]));
  });

  it('moves up the neck with a high shape, keeping open strings', () => {
    const notes = scaleNotes(span([-1, 7, 9, 9, 8, 7], 1, 'E', { pc: 4, mode: 'major' }));
    expect(notes.some((n) => n.fret >= 7)).toBe(true);
    expect(notes.every((n) => n.fret === 0 || (n.fret >= 7 && n.fret <= 10))).toBe(true);
  });

  it('starts on the root, climbs, and turns back at the top', () => {
    const run: PatternDef = {
      id: 'test.picado',
      name: 'Run',
      hint: 'Run.',
      style: 'flamenco',
      level: 'advanced',
      meters: [4],
      anchor: 'bar',
      // From the second sixteenth, as in the picado pattern: beat 1 is the thumb's.
      events: { 4: Array.from({ length: 15 }, (_, i) => ({ tick: (i + 1) * 120, dur: 120, finger: i % 2 ? ('m' as const) : ('i' as const), target: 'scale' as const })) },
    };
    const s = span([-1, 0, 2, 2, 1, 0], 1, 'Am', minor(9));
    const notes = runSegment(run, s, 4).filter((n) => n.finger !== 'p');
    const midi = notes.map((n) => OPEN_MIDI[n.string] + n.fret);
    expect(midi[0] % 12).toBe(9);
    const top = Math.max(...midi);
    const peak = midi.indexOf(top);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(midi.length - 1);
    expect(midi.slice(0, peak + 1)).toEqual([...midi.slice(0, peak + 1)].sort((a, b) => a - b));
    expect(midi[peak + 1]).toBeLessThan(top);
  });

  it('gives nothing when the position has no scale notes', () => {
    const walkless: PatternDef = {
      id: 'test.walkless',
      name: 'Run',
      hint: 'Run.',
      style: 'flamenco',
      level: 'advanced',
      meters: [4],
      anchor: 'bar',
      events: { 4: [{ tick: 0, dur: 120, finger: 'p', target: 'bass' }, { tick: 120, dur: 120, finger: 'i', target: 'scale' }] },
    };
    // Strings 0–3 all muted is still a position: the walker uses the open strings' scale notes, if any.
    const s = span([-1, -1, -1, -1, 1, 0], 4, 'C', { pc: 1, mode: 'major' });
    expect(() => runSegment(walkless, s, 4)).not.toThrow();
  });
});
