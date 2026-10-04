import { parseChord } from './chords.js';
import type { ChordLabel, Frets, Voicing } from './types.js';
import { altBass } from './bass.js';
import { getVoicing, rootStringOf } from './voicings.js';

const label = (t: string) => (parseChord(t) as { label: ChordLabel }).label;

function fromLibrary(name: string) {
  const { voicing, played } = getVoicing(label(name), 'moderate');
  return altBass(voicing, played);
}

function custom(frets: Frets, name: string) {
  const played = label(name);
  const voicing: Voicing = {
    name,
    frets,
    rootString: rootStringOf(frets, played),
    barre: false,
  };
  return altBass(voicing, played);
}

describe('altBass', () => {
  describe('root on string 0', () => {
    it.each([
      ['G', { string: 2, fret: 0 }],
      ['E', { string: 2, fret: 2 }],
      ['Em7', { string: 2, fret: 0 }],
      ['Gsus4', { string: 2, fret: 0 }],
    ])('%s → %j', (name, expected) => {
      expect(fromLibrary(name)).toEqual(expected);
    });

    it('uses string 1 when string 2 is muted', () => {
      expect(custom([3, 2, -1, 0, 0, 3], 'G')).toEqual({ string: 1, fret: 2 });
    });

    it('returns null when strings 1 and 2 are both muted', () => {
      expect(custom([3, -1, -1, 0, 0, 3], 'G')).toBeNull();
    });
  });

  describe('root on string 1', () => {
    it.each([
      ['C', { string: 2, fret: 2 }],
      ['Am', { string: 2, fret: 2 }],
      ['A7', { string: 2, fret: 2 }],
      ['G/B', { string: 2, fret: 0 }],
      ['Bb', { string: 2, fret: 3 }],
    ])('%s → %j', (name, expected) => {
      expect(fromLibrary(name)).toEqual(expected);
    });

    it('returns null when string 2 is muted', () => {
      expect(custom([-1, 3, -1, 0, 1, 0], 'C')).toBeNull();
    });
  });

  describe('root on string 2 or higher', () => {
    it.each(['D', 'Dm', 'D7', 'Dsus2', 'D6', 'Fmaj7'])(
      '%s → open A (a chord tone on a lower string)',
      (name) => {
        expect(fromLibrary(name)).toEqual({ string: 1, fret: 0 });
      },
    );

    it('prefers open A over open E', () => {
      // Am-ish shape rooted on string 2 where both A and E are chord tones
      expect(custom([-1, -1, 7, 5, 5, 5], 'Am')).toEqual({ string: 1, fret: 0 });
    });

    it('uses open E when A is not a chord tone', () => {
      // E rooted on string 2 (fret 2): A isn't in E major, E is
      expect(custom([-1, -1, 2, 1, 0, 0], 'E')).toEqual({ string: 0, fret: 0 });
    });

    it('falls back to the next string up when no open lower string fits', () => {
      // Eb rooted on string 2: neither open A nor open E is in Eb major
      expect(custom([-1, -1, 1, 3, 4, 3], 'Eb')).toEqual({ string: 3, fret: 3 });
    });

    it('returns null when nothing fits', () => {
      expect(custom([-1, -1, 1, -1, 4, 3], 'Eb')).toBeNull();
    });
  });
});
