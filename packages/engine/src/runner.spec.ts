import { parseChord } from './chords.js';
import type { ChordLabel, PatternDef, PatternEvent } from './types.js';
import { type ChordSpan, isPlayable, runSegment } from './runner.js';
import { getVoicing } from './voicings.js';

const BAR = 1920;

function span(name: string, start = 0, end = BAR): ChordSpan {
  const label = (parseChord(name) as { label: ChordLabel }).label;
  const { voicing, played } = getVoicing(label, 'moderate');
  return { start, end, voicing, played };
}

function pattern(events: PatternEvent[], anchor: 'bar' | 'chord' = 'bar'): PatternDef {
  return {
    id: 'test.basic.p',
    name: 'Test',
    hint: '',
    style: 'arpeggio',
    level: 'basic',
    meters: [4],
    anchor,
    events: { 4: events },
  };
}

const ev = (tick: number, target: PatternEvent['target'], extra: Partial<PatternEvent> = {}): PatternEvent => ({
  tick,
  dur: 240,
  finger: target === 'bass' || target === 'altBass' ? 'p' : 'i',
  target,
  ...extra,
});

const strip = (notes: ReturnType<typeof runSegment>) =>
  notes.map(({ tick, string, fret, tech }) => (tech ? { tick, string, fret, tech } : { tick, string, fret }));

describe('runSegment', () => {
  it('resolves targets against the voicing', () => {
    // C: [-1,3,2,0,1,0], root on string 1, alt bass string 2
    const notes = runSegment(
      pattern([ev(0, 'bass'), ev(240, 't3'), ev(480, 't2'), ev(720, 't1'), ev(960, 'altBass'), ev(1200, 't4')]),
      span('C'),
      4,
    );
    expect(strip(notes)).toEqual([
      { tick: 0, string: 1, fret: 3 },
      { tick: 240, string: 3, fret: 0 },
      { tick: 480, string: 4, fret: 1 },
      { tick: 720, string: 5, fret: 0 },
      { tick: 960, string: 2, fret: 2 },
      { tick: 1200, string: 2, fret: 2 },
    ]);
  });

  it('plays every sounded string for `all`', () => {
    const notes = runSegment(pattern([ev(0, 'all')]), span('D'), 4);
    expect(strip(notes)).toEqual([
      { tick: 0, string: 2, fret: 0 },
      { tick: 0, string: 3, fret: 2 },
      { tick: 0, string: 4, fret: 3 },
      { tick: 0, string: 5, fret: 2 },
    ]);
  });

  it('inserts a thumb bass at the chord change and drops the alt bass there', () => {
    const notes = runSegment(pattern([ev(0, 'altBass'), ev(0, 't1'), ev(480, 't2')]), span('G'), 4);
    expect(notes[0]).toMatchObject({ tick: 0, string: 0, fret: 3, finger: 'p' });
    expect(notes.filter((n) => n.tick === 0).map((n) => n.string)).toEqual([0, 5]);
  });

  it('drops events whose target string is muted or missing', () => {
    // D: root on string 2, so t4 (string 2) is the bass and is dropped
    const notes = runSegment(pattern([ev(0, 'bass'), ev(480, 't4')]), span('D'), 4);
    expect(notes).toHaveLength(1);
  });

  it('resolves a `scale` target to one note of the scale walker (picado)', () => {
    const notes = runSegment(pattern([ev(0, 'bass'), ev(480, 'scale')]), span('Am'), 4);
    expect(notes).toHaveLength(2);
    expect(notes[1].string).toBeLessThanOrEqual(3);
  });

  it('keeps the first of two events on the same string and tick', () => {
    const notes = runSegment(
      pattern([ev(0, 'bass'), ev(480, 't1', { finger: 'a' }), ev(480, 't1', { finger: 'm' })]),
      span('Am'),
      4,
    );
    expect(notes.filter((n) => n.tick === 480)).toEqual([expect.objectContaining({ finger: 'a' })]);
  });

  it('restarts a bar-anchored pattern on the bar line, not at the chord', () => {
    const notes = runSegment(pattern([ev(0, 'bass'), ev(480, 't1'), ev(1440, 't2')]), span('Am', 960, BAR), 4);
    // 0 and 480 are before the chord; bass inserted at 960; 1440 is kept
    expect(notes.map((n) => n.tick)).toEqual([960, 1440]);
  });

  it('restarts a chord-anchored pattern at the chord start', () => {
    const notes = runSegment(
      pattern([ev(0, 'bass'), ev(480, 't1')], 'chord'),
      span('Am', 960, BAR),
      4,
    );
    expect(notes.map((n) => n.tick)).toEqual([960, 1440]);
  });

  it('repeats the pattern for chords longer than a bar', () => {
    const notes = runSegment(pattern([ev(0, 'bass')]), span('Am', 0, 2 * BAR), 4);
    expect(notes.map((n) => n.tick)).toEqual([0, BAR]);
  });

  it('cuts notes off at the end of the chord', () => {
    const notes = runSegment(pattern([ev(0, 'bass', { dur: 4000 })]), span('Am', 0, 960), 4);
    expect(notes[0].dur).toBe(960);
  });

  it('defaults velocity to 0.8 and keeps accents', () => {
    const notes = runSegment(pattern([ev(0, 'bass', { accent: true }), ev(480, 't1', { velocity: 0.5 })]), span('Am'), 4);
    expect(notes[0]).toMatchObject({ velocity: 0.8, accent: true });
    expect(notes[1].velocity).toBe(0.5);
  });

  describe('hammer-ons and pull-offs', () => {
    it('hammers onto a fretted note from the open string', () => {
      // Am t2 = string 4, fret 1: the earlier pluck becomes open, the hammer sounds fret 1
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't2'), ev(480, 't2', { tech: 'hammer' })]), span('Am'), 4);
      expect(strip(notes).slice(1)).toEqual([
        { tick: 240, string: 4, fret: 0 },
        { tick: 480, string: 4, fret: 1, tech: 'hammer' },
      ]);
    });

    it('plays a normal stroke when there is no earlier note on the string', () => {
      const notes = runSegment(pattern([ev(0, 'bass'), ev(480, 't2', { tech: 'hammer' })]), span('Am'), 4);
      expect(notes[1].tech).toBeUndefined();
    });

    it('plays a normal stroke when the earlier note is more than a beat ago', () => {
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't2'), ev(960, 't2', { tech: 'hammer' })]), span('Am'), 4);
      expect(notes[2].tech).toBeUndefined();
      expect(notes[1].fret).toBe(1);
    });

    it('cannot hammer onto an open string', () => {
      // Am t1 = string 5, fret 0
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't1'), ev(480, 't1', { tech: 'hammer' })]), span('Am'), 4);
      expect(notes[2].tech).toBeUndefined();
    });

    it('does not stretch a hammer-on above fret 2', () => {
      // C bass string 1 fret 3
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 'bass', { tech: 'hammer' })]), span('C'), 4);
      expect(notes[1].tech).toBeUndefined();
      expect(notes[0].fret).toBe(3);
    });

    it('pulls off to the open string when the earlier note sits on the same fret', () => {
      // Am t2 = string 4, fret 1: pluck C, pull off to the open B (in A minor)
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't2'), ev(480, 't2', { tech: 'pull' })]), span('Am'), 4);
      expect(strip(notes).slice(1)).toEqual([
        { tick: 240, string: 4, fret: 1 },
        { tick: 480, string: 4, fret: 0, tech: 'pull' },
      ]);
    });

    it('cannot pull off under a barre', () => {
      // F barre: t1 = string 5, fret 1, the barre itself
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't1'), ev(480, 't1', { tech: 'pull' })]), span('F'), 4);
      expect(notes.find((n) => n.tick === 480)).toMatchObject({ fret: 1 });
      expect(notes.find((n) => n.tick === 480)?.tech).toBeUndefined();
    });

    it('hammers from the barre onto a fretted note', () => {
      // F barre [1,3,3,2,1,1]: t3 = string 3, fret 2; the earlier pluck sounds the barre (fret 1)
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't3'), ev(480, 't3', { tech: 'hammer' })]), span('F'), 4);
      expect(strip(notes).filter((n) => n.string === 3)).toEqual([
        { tick: 240, string: 3, fret: 1 },
        { tick: 480, string: 3, fret: 2, tech: 'hammer' },
      ]);
    });

    it('hammers from an open chord tone up to a scale note two frets higher', () => {
      // Em t1 = open E; F# is in E minor and a free finger can reach fret 2
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't1'), ev(480, 't1', { tech: 'hammer' })]), span('Em'), 4);
      expect(strip(notes).filter((n) => n.string === 5)).toEqual([
        { tick: 240, string: 5, fret: 0 },
        { tick: 480, string: 5, fret: 2, tech: 'hammer' },
      ]);
    });
  });

  describe('harmonics', () => {
    it('sounds a chord tone at fret 12 when the open string is one', () => {
      // C t1 = open E, a chord tone
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't1', { tech: 'harmonic' })]), span('C'), 4);
      expect(strip(notes)[1]).toEqual({ tick: 240, string: 5, fret: 12, tech: 'harmonic' });
    });

    it('uses fret 7 (a fifth up) when that is the chord tone', () => {
      // G: E is not in G, but B (E + 7) is
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't1', { tech: 'harmonic' })]), span('G'), 4);
      expect(strip(notes)[1]).toEqual({ tick: 240, string: 5, fret: 7, tech: 'harmonic' });
    });

    it('plays the shape note when no harmonic on the string is a chord tone', () => {
      const notes = runSegment(pattern([ev(0, 'bass'), ev(240, 't1', { tech: 'harmonic' })]), span('F'), 4);
      expect(strip(notes)[1]).toEqual({ tick: 240, string: 5, fret: 1 });
    });

    it('drops the harmonic when a fretted note sounds with it', () => {
      // C bass is fretted (string 1, fret 3) on the same tick
      const notes = runSegment(pattern([ev(0, 'bass'), ev(0, 't1', { tech: 'harmonic' })]), span('C'), 4);
      expect(strip(notes)).toContainEqual({ tick: 0, string: 5, fret: 0 });
    });
  });

  describe('percussion and damping', () => {
    it('turns a slap into one pitchless note that can sound with the bass', () => {
      const notes = runSegment(pattern([ev(0, 'bass'), ev(480, 'bass'), ev(480, 'all', { finger: 'p', tech: 'slap' })]), span('Am'), 4);
      expect(strip(notes).filter((n) => n.tick === 480)).toEqual([
        { tick: 480, string: 0, fret: -1, tech: 'slap' },
        { tick: 480, string: 1, fret: 0 },
      ]);
    });

    it('turns an apagado into one pitchless note', () => {
      const notes = runSegment(pattern([ev(0, 'all', { tech: 'rasgueo-down' }), ev(240, 'all', { tech: 'apagado' })]), span('Am'), 4);
      expect(strip(notes).filter((n) => n.tick === 240)).toEqual([{ tick: 240, string: 0, fret: -1, tech: 'apagado' }]);
    });

    it('keeps palm-mute on a plucked note', () => {
      const notes = runSegment(pattern([ev(0, 'bass', { tech: 'palm-mute' })]), span('Am'), 4);
      expect(strip(notes)[0]).toEqual({ tick: 0, string: 1, fret: 0, tech: 'palm-mute' });
    });
  });
});

describe('isPlayable', () => {
  const note = (tick: number, string: number, fret: number) => ({
    tick,
    dur: 240,
    string,
    fret,
    finger: 'i' as const,
    velocity: 0.8,
  });

  it('accepts notes within a four-fret span', () => {
    expect(isPlayable([note(0, 0, 1), note(0, 5, 4)], span('C').voicing)).toBe(true);
  });

  it('rejects simultaneous notes more than four frets apart', () => {
    expect(isPlayable([note(0, 0, 1), note(0, 5, 6)], span('C').voicing)).toBe(false);
  });

  it('ignores the span between notes at different ticks', () => {
    expect(isPlayable([note(0, 0, 1), note(240, 5, 9)], span('C').voicing)).toBe(true);
  });

  it('rejects more than four fretted fingers', () => {
    const notes = [note(0, 0, 1), note(0, 1, 2), note(0, 2, 3), note(0, 3, 2), note(0, 4, 1)];
    expect(isPlayable(notes, span('C').voicing)).toBe(false);
  });

  it('counts a barre as one finger', () => {
    const f = span('F');
    const notes = f.voicing.frets.map((fret, s) => note(0, s, fret));
    expect(isPlayable(notes, f.voicing)).toBe(true);
  });
});
