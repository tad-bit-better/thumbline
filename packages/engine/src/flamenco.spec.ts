import { arrange, flamencoCapo, patternCandidates } from './arrange.js';
import { bestCapo } from './capo.js';
import { parseChord } from './chords.js';
import { PALOS, patternsFor } from './patterns/index.js';
import { type ChordSpan, campanellaNotes, runSegment, scaleNotes } from './runner.js';
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

  it('follows a key change: the run takes the key of its own bar (M10b)', () => {
    // Am throughout; A minor for two bars, then D minor (B becomes Bb).
    const song: AnalysisResult = { ...progression('Am | Am | Am | Am'), key: minor(9), keys: [{ bar: 0, key: minor(9) }, { bar: 2, key: minor(2) }] };
    const a = arrange(song, { style: 'flamenco', level: 'advanced', palo: 'tangos', patternId: 'flamenco.advanced.tangos-picado', capo: 0 });
    const runPcs = (fromBar: number, toBar: number) =>
      new Set(a.events.filter((e) => e.tick >= fromBar * 1920 && e.tick < toBar * 1920 && e.tech === 'apoyando' && e.fret >= 0).map((e) => (OPEN_MIDI[e.string] + e.fret) % 12));
    expect(runPcs(0, 2).has(11)).toBe(true);
    expect(runPcs(0, 2).has(10)).toBe(false);
    expect(runPcs(2, 4).has(10)).toBe(true);
    expect(runPcs(2, 4).has(11)).toBe(false);
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

describe('drones, pedal tones and campanella', () => {
  const E_SHAPE = voicing([0, 2, 2, 1, 0, 0], 0, 'E');
  const F_SHAPE: Voicing = { ...voicing([1, 3, 3, 2, 1, 1], 0, 'F'), barre: true };
  const D_SHAPE = voicing([-1, -1, 0, 2, 3, 2], 2, 'D');
  const span = (v: Voicing, played: string, key = minor(9)): ChordSpan => ({ start: 0, end: 1920, voicing: v, played: label(played), key });
  const one = (target: 'drone' | 'pedal' | 'campanella'): PatternDef => ({
    id: 'test.one',
    name: 'One',
    hint: 'One.',
    style: 'flamenco',
    level: 'advanced',
    meters: [4],
    anchor: 'bar',
    events: { 4: [{ tick: 0, dur: 480, finger: 'p', target: 'bass' }, { tick: 480, dur: 480, finger: target === 'pedal' ? 'p' : 'a', target }] },
  });
  const at480 = (notes: ReturnType<typeof runSegment>) => notes.filter((n) => n.tick === 480).map(({ string, fret }) => ({ string, fret }));

  const G_SHAPE = voicing([3, 2, 0, 0, 0, 3], 0, 'G');

  it('rings the open top string as a drone when it is in the key (the finger lifts)', () => {
    // A minor: open E is in the scale, so it rings over G instead of the fretted G
    expect(at480(runSegment(one('drone'), span(G_SHAPE, 'G'), 4))).toEqual([{ string: 5, fret: 0 }]);
  });

  it('falls back to the shape’s top note when neither open E nor B is in the key, or under a barre', () => {
    // D over Db major: neither E nor B is in the scale or the chord
    expect(at480(runSegment(one('drone'), span(D_SHAPE, 'D', { pc: 1, mode: 'major' }), 4))).toEqual([{ string: 5, fret: 2 }]);
    // The barre covers the open strings
    expect(at480(runSegment(one('drone'), span(F_SHAPE, 'F'), 4))).toEqual([{ string: 5, fret: 1 }]);
  });

  it('holds the key’s tonic, else its fifth, on an open bass string as a pedal', () => {
    // A minor: open A (string 1)
    expect(at480(runSegment(one('pedal'), span(E_SHAPE, 'E'), 4))).toEqual([{ string: 1, fret: 0 }]);
    // D minor: open D (string 2)
    expect(at480(runSegment(one('pedal'), span(G_SHAPE, 'G', minor(2)), 4))).toEqual([{ string: 2, fret: 0 }]);
    // B minor: neither B nor F# is an open bass string, so the chord's own bass
    expect(at480(runSegment(one('pedal'), span(E_SHAPE, 'E', minor(11)), 4))).toEqual([{ string: 0, fret: 0 }]);
    // Under a barre: the chord's own bass
    expect(at480(runSegment(one('pedal'), span(F_SHAPE, 'F'), 4))).toEqual([{ string: 0, fret: 1 }]);
  });

  it('spreads campanella scale notes over different strings, open strings ringing', () => {
    const notes = campanellaNotes(span(voicing([-1, 0, 2, 2, 1, 0], 1, 'Am'), 'Am'));
    const midi = notes.map((n) => OPEN_MIDI[n.string] + n.fret);
    expect(midi).toEqual([...midi].sort((a, b) => a - b));
    expect(notes.some((n) => n.fret === 0)).toBe(true);
    expect(notes.every((n) => n.string >= 2 && n.fret <= 5)).toBe(true);
    // Every note of the scale is there: no step skips more than a tone.
    for (let i = 1; i < midi.length; i++) expect(midi[i] - midi[i - 1]).toBeLessThanOrEqual(2);
    // The bell effect: a higher note on a lower string, so the one before keeps ringing.
    expect(notes.some((n, i) => i > 0 && n.string < notes[i - 1].string)).toBe(true);
  });
});

describe('flamenco tremolo', () => {
  it('repeats one note: the top line does not move it', () => {
    const a = arrange(ANDALUSIAN, { style: 'flamenco', level: 'advanced', patternId: 'flamenco.advanced.tremolo' });
    const bar1 = a.events.filter((e) => e.tick < 1920 && e.tech === 'tremolo');
    expect(new Set(bar1.map((e) => `${e.string}:${e.fret}`)).size).toBe(1);
  });
});
