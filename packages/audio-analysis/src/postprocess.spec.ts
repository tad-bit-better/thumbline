import {
  type BeatFeatures,
  detectMeter,
  extendBeats,
  rankChords,
  toSegments,
} from './postprocess.js';

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

  it('is less confident about an ambiguous bar', () => {
    const clear = toSegments(beats(['C', 'C', 'C', 'C']), 4, 0)[0].confidence;
    const mixed = beats(['C', 'C', 'C', 'C']).map((b, i) => ({ ...b, chroma: Array.from(b.chroma, (v, k) => v + chroma('Am', i)[k] * 0.9) }));
    expect(toSegments(mixed, 4, 0)[0].confidence).toBeLessThan(clear);
  });
});

describe('extendBeats', () => {
  it('fills in beats missed at the start, at the opening tempo', () => {
    expect(extendBeats([1.1, 1.6, 2.1, 2.6])).toEqual([0.1, 0.6, 1.1, 1.6, 2.1, 2.6].map((x) => expect.closeTo(x, 6)));
  });

  it('leaves beats that already start near zero', () => {
    expect(extendBeats([0.2, 0.7, 1.2])).toEqual([0.2, 0.7, 1.2]);
  });

  it('copes with too few beats', () => {
    expect(extendBeats([1])).toEqual([1]);
  });
});
