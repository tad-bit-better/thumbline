import { cleanMelody, trackMelody } from './melody.js';
import { loadEssentiaNode } from './testing/node-essentia.js';
import type { MelodyNote } from './types.js';

const n = (startSec: number, durSec: number, midi: number, confidence = 0.8): MelodyNote => ({ startSec, durSec, midi, confidence });
const A_MINOR = { pc: 9, mode: 'minor' as const };
const midis = (notes: MelodyNote[]) => notes.map((x) => x.midi);

describe('cleanMelody', () => {
  it('drops blips shorter than 90 ms', () => {
    expect(midis(cleanMelody([n(0, 0.3, 69), n(0.3, 0.05, 71), n(0.4, 0.3, 72)], A_MINOR))).toEqual([69, 72]);
  });

  it('moves an octave slip back next to its neighbours', () => {
    const line = [n(0, 0.3, 69), n(0.3, 0.3, 71), n(0.6, 0.3, 84), n(1.0, 0.3, 74), n(1.3, 0.3, 71)];
    expect(midis(cleanMelody(line, A_MINOR))).toEqual([69, 71, 72, 74, 71]);
  });

  it('merges a held note the tracker split in two', () => {
    const out = cleanMelody([n(0, 0.4, 69, 0.5), n(0.45, 0.4, 69, 0.9)], A_MINOR);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startSec: 0, midi: 69, confidence: 0.9 });
    expect(out[0].durSec).toBeCloseTo(0.85, 6);
  });

  it('keeps a repeated note that is re-sung after a gap', () => {
    expect(cleanMelody([n(0, 0.3, 69), n(0.6, 0.3, 69)], A_MINOR)).toHaveLength(2);
  });

  it('snaps a short out-of-key note into the key, but keeps a long one', () => {
    // A# (70) isn't in A minor: short, so it becomes A; a long G# stays (the leading tone, sung on purpose)
    const out = cleanMelody([n(0, 0.2, 70), n(0.5, 0.6, 68)], A_MINOR);
    expect(midis(out)).toEqual([69, 68]);
  });

  it('snaps into the key of the moment when the song changes key', () => {
    // F major until 10 s, then F# major: a short A is at home in F, a short A# at home in F#.
    const keyAt = (sec: number) => (sec < 10 ? { pc: 5, mode: 'major' as const } : { pc: 6, mode: 'major' as const });
    const out = cleanMelody([n(1, 0.2, 69), n(2, 0.2, 66), n(11, 0.2, 70), n(12, 0.2, 69)], keyAt);
    // A stays; F# (not in F) moves to F or G; A# stays; A (not in F#) moves to G# or A#.
    expect(midis(out)[0]).toBe(69);
    expect([65, 67]).toContain(midis(out)[1]);
    expect(midis(out)[2]).toBe(70);
    expect([68, 70]).toContain(midis(out)[3]);
  });
});

describe('trackMelody', () => {
  const essentia = loadEssentiaNode();
  // A held A4 sung 65 cents flat, as on a record mastered slow.
  const flat = 440 * 2 ** (-65 / 1200);
  const tone = Float32Array.from({ length: 44100 * 2 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * flat * i) / 44100));

  it('reads the notes against the recording\'s A', () => {
    expect(trackMelody(essentia, tone, 44100).map((n) => n.midi)).toEqual([68]);
    expect(trackMelody(essentia, tone, 44100, flat).map((n) => n.midi)).toEqual([69]);
  });
});
