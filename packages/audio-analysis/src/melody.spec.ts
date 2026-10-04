import { cleanMelody } from './melody.js';
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
});
