import {
  type BeatFeatures,
  assignBass,
  detectMeter,
  extendBeats,
  foldBeats,
  keySections,
  lowBandAlternation,
  rankChords,
  refineMode,
  toSegments,
} from './postprocess.js';
import type { ChordSegment } from './types.js';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const SHAPES: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], dim: [0, 3, 6] };

/** A plausible beat chroma for a chord name, with a little noise. */
function chroma(name: string, seed = 1, noise = 0.08): number[] {
  const m = /^([A-G][b#]?)(.*)$/.exec(name) as RegExpExecArray;
  const root = PC[m[1]];
  const c = Array.from({ length: 12 }, (_, i) => noise * Math.abs(Math.sin(seed * 7.3 + i * 1.7)));
  SHAPES[m[2]].forEach((iv, k) => {
    c[(root + iv) % 12] += k === 0 ? 1 : k === 3 ? 0.75 : 0.85;
  });
  return c;
}

const beats = (names: string[], energy = 1): BeatFeatures[] =>
  names.map((n, i) => ({ chroma: n === '-' ? new Array(12).fill(0.01) : chroma(n, i + 1), energy: n === '-' ? 0.0001 : energy }));

const SUFFIX: Record<string, string> = { maj: '', m: 'm', '7': '7', m7: 'm7', maj7: 'maj7', sus2: 'sus2', sus4: 'sus4', dim: 'dim' };
const chordName = (c: { pc: number; quality: string }) => NAMES[c.pc] + SUFFIX[c.quality];
const label = (s: { chord: { pc: number; quality: string } | null }) => (s.chord ? chordName(s.chord) : '-');

describe('rankChords', () => {
  it.each(['C', 'Am', 'G7', 'Em7', 'Fmaj7', 'Dsus4', 'Bdim', 'Eb', 'F#m'])('recognises %s', (name) => {
    expect(chordName(rankChords(chroma(name))[0].label)).toBe(name);
  });

  it('prefers the plain triad when the extra note is weak', () => {
    const c = chroma('G');
    c[5] += 0.15; // faint F
    expect(chordName(rankChords(c)[0].label)).toBe('G');
  });

  it('ranks every chord, best first', () => {
    const r = rankChords(chroma('C'));
    expect(r.length).toBeGreaterThan(24);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
  });
});

describe('detectMeter', () => {
  const fourFour = ['C', 'C', 'C', 'C', 'Am', 'Am', 'Am', 'Am', 'F', 'F', 'F', 'F', 'G', 'G', 'G', 'G'];

  it('finds 4/4 and the downbeat', () => {
    expect(detectMeter(beats([...fourFour, ...fourFour]))).toEqual({ beatsPerBar: 4, firstDownbeat: 0 });
  });

  it('finds the downbeat when the clip starts on beat 3', () => {
    const shifted = ['G', 'G', ...fourFour, ...fourFour];
    expect(detectMeter(beats(shifted))).toEqual({ beatsPerBar: 4, firstDownbeat: 2 });
  });

  it('finds 3/4', () => {
    const waltz = ['D', 'D', 'D', 'G', 'G', 'G', 'A7', 'A7', 'A7', 'D', 'D', 'D', 'Bm', 'Bm', 'Bm', 'Em', 'Em', 'Em'];
    expect(detectMeter(beats([...waltz, ...waltz]))).toEqual({ beatsPerBar: 3, firstDownbeat: 0 });
  });

  it('defaults to 4/4 from bar 0 when nothing changes', () => {
    expect(detectMeter(beats(new Array(16).fill('C')))).toEqual({ beatsPerBar: 4, firstDownbeat: 0 });
  });
});

describe('toSegments', () => {
  it('gives one segment per chord change, on bar lines', () => {
    const segs = toSegments(beats(['C', 'C', 'C', 'C', 'Am', 'Am', 'Am', 'Am', 'Am', 'Am', 'Am', 'Am', 'G', 'G', 'G', 'G']), 4, 0);
    expect(segs.map((s) => [s.bar, s.beat, label(s)])).toEqual([
      [0, 0, 'C'],
      [1, 0, 'Am'],
      [3, 0, 'G'],
    ]);
  });

  it('allows a change halfway through a 4/4 bar', () => {
    const segs = toSegments(beats(['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F']), 4, 0);
    expect(segs.map((s) => [s.bar, s.beat, label(s)])).toEqual([
      [0, 0, 'C'],
      [0, 2, 'G'],
      [1, 0, 'Am'],
      [1, 2, 'F'],
    ]);
  });

  it('ignores a single odd beat (passing note)', () => {
    const segs = toSegments(beats(['C', 'C', 'C', 'Dm', 'C', 'C', 'C', 'C']), 4, 0);
    expect(segs.map(label)).toEqual(['C']);
  });

  it('marks silence as no chord', () => {
    const segs = toSegments(beats(['C', 'C', 'C', 'C', '-', '-', '-', '-', 'G', 'G', 'G', 'G']), 4, 0);
    expect(segs.map(label)).toEqual(['C', '-', 'G']);
  });

  it('skips pickup beats before the first downbeat', () => {
    const segs = toSegments(beats(['G', 'C', 'C', 'C', 'C']), 4, 1);
    expect(segs.map((s) => [s.bar, label(s)])).toEqual([[0, 'C']]);
  });

  it('gives up to three alternatives and a confidence', () => {
    const [seg] = toSegments(beats(['Am', 'Am', 'Am', 'Am']), 4, 0);
    expect(seg.alternatives).toHaveLength(3);
    expect(seg.alternatives.map((a) => chordName(a))).not.toContain('Am');
    expect(seg.confidence).toBeGreaterThan(0);
    expect(seg.confidence).toBeLessThanOrEqual(1);
  });

  it('hears the harmony in the side signal when a centred voice sings other notes', () => {
    // The mix is dominated by a voice on D and B; the side signal (no voice) has plain C.
    const voice = Array.from({ length: 12 }, (_, i) => (i === 2 || i === 11 ? 2 : 0));
    const mixed = beats(new Array(8).fill('C')).map((b) => ({ ...b, chroma: Array.from(b.chroma, (v, i) => v + voice[i]), side: b.chroma }));
    expect(toSegments(mixed, 4, 0).map(label)).toEqual(['C']);
    expect(toSegments(mixed.map((b) => ({ chroma: b.chroma, energy: b.energy })), 4, 0).map(label)).not.toEqual(['C']);
  });

  it('takes the root from the bass when the upper notes fit two chords', () => {
    // E and G strong, B and C fainter: C and Em score within 0.01 of each other. The bass decides.
    const both = Array.from({ length: 12 }, (_, i) => ([4, 7].includes(i) ? 1 : i === 11 ? 0.6 : i === 0 ? 0.4 : 0.02));
    const withBass = (pc: number) => new Array(8).fill(0).map(() => ({ chroma: both, energy: 1, bass: Array.from({ length: 12 }, (_, i) => (i === pc ? 1 : 0)) }));
    expect(toSegments(withBass(0), 4, 0).map(label)).toEqual(['C']);
    expect(toSegments(withBass(4), 4, 0).map(label)).toEqual(['Em']);
  });

  it('counts an inversion\'s bass note for the chord (G/B stays G)', () => {
    const gOverB = beats(new Array(8).fill('G')).map((b) => ({ ...b, bass: Array.from({ length: 12 }, (_, i) => (i === 11 ? 1 : 0)) }));
    expect(toSegments(gOverB, 4, 0).map(label)).toEqual(['G']);
  });

  it('prefers the chord that belongs to the key when the evidence is split', () => {
    // E, G, G# and B: E major or E minor. In C major it's Em; in A major it's E.
    const split = Array.from({ length: 12 }, (_, i) => ([4, 7, 8, 11].includes(i) ? 1 : 0.02));
    const bars = new Array(8).fill(0).map(() => ({ chroma: split, energy: 1 }));
    expect(toSegments(bars, 4, 0, { pc: 0, mode: 'major' }).map(label)).toEqual(['Em']);
    expect(toSegments(bars, 4, 0, { pc: 9, mode: 'major' }).map(label)).toEqual(['E']);
  });

  it('does not flicker when every other half bar leans to another chord', () => {
    const wobbly = ['C', 'C', 'Am', 'Am'].flatMap((n) => [n]).concat(['C', 'C', 'Am', 'Am'], ['C', 'C', 'Am', 'Am']);
    const leaning = beats(new Array(wobbly.length).fill('C')).map((b, i) => ({
      ...b,
      chroma: Array.from(b.chroma, (v, k) => v + (wobbly[i] === 'Am' ? chroma('Am', i)[k] * 0.95 : 0)),
    }));
    expect(toSegments(leaning, 4, 0).map(label)).toEqual(['C']);
  });

  it('is less confident about an ambiguous bar', () => {
    const clear = toSegments(beats(['C', 'C', 'C', 'C']), 4, 0)[0].confidence;
    const mixed = beats(['C', 'C', 'C', 'C']).map((b, i) => ({ ...b, chroma: Array.from(b.chroma, (v, k) => v + chroma('Am', i)[k] * 0.9) }));
    expect(toSegments(mixed, 4, 0)[0].confidence).toBeLessThan(clear);
  });
});

describe('foldBeats', () => {
  const steady = (from: number, step: number, n: number) => Array.from({ length: n }, (_, i) => from + i * step);
  const gaps = (t: number[]) => t.slice(1).map((x, i) => x - t[i]);

  it('leaves a steady song alone', () => {
    const t = steady(0, 0.5, 40);
    expect(foldBeats(t)).toEqual(t);
  });

  it('leaves a gentle slow-down alone', () => {
    const t = [0];
    for (let i = 1; i < 40; i++) t.push(t[i - 1] + 0.5 * (1 + 0.004 * i)); // up to ~16% slower
    expect(foldBeats(t)).toEqual(t);
  });

  it('folds a stretch counted 1.5× too fast back to the song’s beat (My Heart Will Go On’s free-time intro)', () => {
    // 20 beats at 0.5 s, 12 at 0.333 s (4 s: 8 real beats), then 20 at 0.5 s.
    const fast = steady(9.5 + 1 / 3, 1 / 3, 12);
    const t = [...steady(0, 0.5, 20), ...fast, ...steady(13.5 + 0.5, 0.5, 20)].map((x) => Math.round(x * 1e6) / 1e6);
    const out = foldBeats(t);
    expect(out.length).toBe(t.length - 4);
    expect(Math.max(...gaps(out))).toBeLessThan(0.56);
    expect(Math.min(...gaps(out))).toBeGreaterThan(0.44);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(t.at(-1));
  });

  it('folds a stretch counted twice too fast', () => {
    const t = [...steady(0, 0.5, 20), ...steady(10, 0.25, 16), ...steady(14, 0.5, 20)];
    const out = foldBeats(t);
    expect(out.length).toBe(t.length - 8);
    expect(Math.max(...gaps(out))).toBeLessThan(0.56);
    expect(Math.min(...gaps(out))).toBeGreaterThan(0.44);
  });
});

describe('extendBeats', () => {
  it('fills in beats missed at the start, at the opening tempo', () => {
    expect(extendBeats([1.1, 1.6, 2.1, 2.6])).toEqual([0.1, 0.6, 1.1, 1.6, 2.1, 2.6].map((x) => expect.closeTo(x, 6)));
  });

  it('keeps a missed beat that falls just before zero, at zero', () => {
    expect(extendBeats([0.59, 1.18, 1.77])).toEqual([0, 0.59, 1.18, 1.77].map((x) => expect.closeTo(x, 6)));
  });

  it('leaves beats that already start near zero', () => {
    expect(extendBeats([0.2, 0.7, 1.2])).toEqual([0.2, 0.7, 1.2]);
  });

  it('copes with too few beats', () => {
    expect(extendBeats([1])).toEqual([1]);
  });
});

describe('lowBandAlternation', () => {
  const SR = 8000;
  const beatsAt = (n: number, step: number) => Array.from({ length: n }, (_, i) => 0.1 + i * step);
  const thump = (x: Float32Array, t: number, amp: number) => {
    const at = Math.floor(t * SR);
    for (let i = 0; i < 400 && at + i < x.length; i++) x[at + i] += amp * Math.sin((2 * Math.PI * 60 * i) / SR) * Math.exp(-i / 200);
  };

  it('is near 1 when every beat has the same bass', () => {
    const x = new Float32Array(SR * 5);
    const beats = beatsAt(16, 0.25);
    beats.forEach((t) => thump(x, t, 0.5));
    expect(lowBandAlternation(x, SR, beats)).toBeGreaterThan(0.9);
  });

  it('is low when the bass hits every other beat', () => {
    const x = new Float32Array(SR * 5);
    const beats = beatsAt(16, 0.25);
    beats.forEach((t, i) => thump(x, t, i % 2 ? 0.05 : 0.5));
    expect(lowBandAlternation(x, SR, beats)).toBeLessThan(0.3);
  });

  it('is 1 for silence', () => {
    expect(lowBandAlternation(new Float32Array(SR), SR, [0.1, 0.3, 0.5])).toBe(1);
  });
});

describe('refineMode', () => {
  const seg = (bar: number, pc: number, quality: 'maj' | 'm' | '7'): ChordSegment => ({ bar, beat: 0, chord: { pc, quality }, confidence: 1, alternatives: [] });
  // Hotel California's verse in A minor: Am E7 G D F C Dm E7, back to Am to end.
  const verse = [seg(0, 9, 'm'), seg(1, 4, '7'), seg(2, 7, 'maj'), seg(3, 2, 'maj'), seg(4, 5, 'maj'), seg(5, 0, 'maj'), seg(6, 2, 'm'), seg(7, 4, '7'), seg(8, 9, 'm')];

  it('moves a "C major" song that lives on Am to A minor', () => {
    expect(refineMode({ pc: 0, mode: 'major' }, verse, 4)).toEqual({ pc: 9, mode: 'minor' });
  });

  it('keeps a major song that lives on its tonic', () => {
    const pop = [seg(0, 0, 'maj'), seg(1, 9, 'm'), seg(2, 5, 'maj'), seg(3, 7, 'maj'), seg(4, 0, 'maj')];
    expect(refineMode({ pc: 0, mode: 'major' }, pop, 4)).toEqual({ pc: 0, mode: 'major' });
  });

  it('moves a "minor" key to its relative major when the major chord is home', () => {
    const pop = [seg(0, 0, 'maj'), seg(1, 7, 'maj'), seg(2, 9, 'm'), seg(3, 5, 'maj'), seg(4, 0, 'maj')];
    expect(refineMode({ pc: 9, mode: 'minor' }, pop, 4)).toEqual({ pc: 0, mode: 'major' });
  });

  it('leaves the key alone when neither home chord clearly wins', () => {
    const torn = [seg(0, 0, 'maj'), seg(1, 9, 'm'), seg(2, 0, 'maj'), seg(3, 9, 'm')];
    expect(refineMode({ pc: 0, mode: 'major' }, torn, 4)).toEqual({ pc: 0, mode: 'major' });
  });
});

describe('keySections', () => {
  type Q = 'maj' | 'm' | '7';
  const parse = (name: string): [number, Q] => {
    const m = /^([A-G][b#]?)(m|7)?$/.exec(name) as RegExpExecArray;
    return [PC[m[1]], (m[2] ?? 'maj') as Q];
  };
  /** One chord per bar from `from`. */
  const bars = (names: string[], from = 0): ChordSegment[] =>
    names.map((n, i) => {
      const [pc, quality] = parse(n);
      return { bar: from + i, beat: 0, chord: { pc, quality }, confidence: 1, alternatives: [] };
    });
  const inF = ['F', 'C', 'Bb', 'Dm', 'Gm', 'C', 'F', 'F', 'Dm', 'Bb', 'C', 'F', 'Gm', 'Bb', 'C', 'F'];
  const inFSharp = ['F#', 'C#', 'B', 'D#m', 'G#m', 'C#', 'F#', 'F#', 'D#m', 'B', 'C#', 'F#', 'G#m', 'B', 'C#', 'F#'];

  it("finds a half-step key change (My Heart Will Go On: F, then F#), whatever the whole song's key said", () => {
    const chords = [...bars(inF), ...bars(inFSharp, 16)];
    expect(keySections(chords, 4, { pc: 1, mode: 'major' })).toEqual([
      { bar: 0, key: { pc: 5, mode: 'major' } },
      { bar: 16, key: { pc: 6, mode: 'major' } },
    ]);
  });

  it('keeps one key for a song that stays home', () => {
    const pop = bars(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C']);
    expect(keySections(pop, 4, { pc: 0, mode: 'major' })).toEqual([{ bar: 0, key: { pc: 0, mode: 'major' } }]);
  });

  it('keeps the key through a short borrowed passage', () => {
    const song = bars(['C', 'G', 'Am', 'F', 'C', 'G', 'Bb', 'Eb', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C']);
    expect(keySections(song, 4, { pc: 0, mode: 'major' })).toEqual([{ bar: 0, key: { pc: 0, mode: 'major' } }]);
  });

  it('lets each section choose between a key and its relative', () => {
    const minor = bars(['Am', 'E7', 'Am', 'Dm', 'Am', 'E7', 'Am', 'G', 'C', 'E7', 'Am', 'Dm', 'E7', 'Am', 'E7', 'Am']);
    const major = bars(['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D', 'D', 'A', 'Bm', 'G', 'D', 'G', 'A', 'D'], 16);
    expect(keySections([...minor, ...major], 4, { pc: 0, mode: 'major' })).toEqual([
      { bar: 0, key: { pc: 9, mode: 'minor' } },
      { bar: 16, key: { pc: 2, mode: 'major' } },
    ]);
  });

  it('has nothing to say without chords', () => {
    expect(keySections([], 4, { pc: 7, mode: 'major' })).toEqual([{ bar: 0, key: { pc: 7, mode: 'major' } }]);
  });
});

describe('assignBass', () => {
  const seg = (bar: number, pc: number, quality: 'maj' | 'm' | '7' | 'm7'): ChordSegment => ({ bar, beat: 0, chord: { pc, quality }, confidence: 1, alternatives: [] });
  /** Beats whose bass band rings on the given pitch classes (one per beat, cycling). */
  const withBass = (pcs: number[], beats: number): BeatFeatures[] =>
    Array.from({ length: beats }, (_, i) => {
      const bass = new Array(12).fill(0.01);
      bass[pcs[i % pcs.length]] = 1;
      return { chroma: new Array(12).fill(0.1), energy: 1, bass };
    });

  it('keeps a held bass under the chord as its bass note (Cm over an Ab sub-bass: Cm/Ab)', () => {
    const out = assignBass([seg(0, 0, 'm')], withBass([8], 4), 4, 0);
    expect(out[0].chord).toEqual({ pc: 0, quality: 'm', bassPc: 8 });
  });

  it('keeps B over a held C# (EDM pads over a moving bass)', () => {
    expect(assignBass([seg(0, 11, 'maj')], withBass([1], 4), 4, 0)[0].chord).toEqual({ pc: 11, quality: 'maj', bassPc: 1 });
  });

  it('leaves the root alone', () => {
    expect(assignBass([seg(0, 0, 'maj')], withBass([0], 4), 4, 0)[0].chord).toEqual({ pc: 0, quality: 'maj' });
  });

  it('leaves a picked, alternating bass alone', () => {
    expect(assignBass([seg(0, 0, 'maj')], withBass([0, 7, 4, 7], 4), 4, 0)[0].chord).toEqual({ pc: 0, quality: 'maj' });
  });

  it('hears a minor chord over its major third as major (Em over a held G#: E)', () => {
    expect(assignBass([seg(0, 4, 'm')], withBass([8], 4), 4, 0)[0].chord).toEqual({ pc: 4, quality: 'maj', bassPc: 8 });
  });

  it('does not put a bass a semitone under a chord tone (C over B would clash)', () => {
    expect(assignBass([seg(0, 0, 'maj')], withBass([11], 4), 4, 0)[0].chord).toEqual({ pc: 0, quality: 'maj' });
  });

  it('reads each chord over its own beats', () => {
    const feats = [...withBass([8], 4), ...withBass([10], 4)];
    const out = assignBass([seg(0, 0, 'm'), seg(1, 10, 'maj')], feats, 4, 0);
    expect(out.map((c) => c.chord)).toEqual([{ pc: 0, quality: 'm', bassPc: 8 }, { pc: 10, quality: 'maj' }]);
  });
});
