import { chordName, chordTones, parseChord, pcOf, transpose } from './chords.js';

describe('pcOf', () => {
  it.each([
    ['C', 0],
    ['C#', 1],
    ['Db', 1],
    ['E', 4],
    ['Fb', 4],
    ['E#', 5],
    ['B#', 0],
    ['Cb', 11],
    ['Bb', 10],
  ])('%s → %i', (name, pc) => {
    expect(pcOf(name)).toBe(pc);
  });

  it('rejects anything that is not a note name', () => {
    expect(pcOf('H')).toBeNull();
    expect(pcOf('')).toBeNull();
    expect(pcOf('c')).toBeNull();
  });
});

describe('parseChord', () => {
  it.each([
    ['C', 0, 'maj'],
    ['Cmaj', 0, 'maj'],
    ['CM', 0, 'maj'],
    ['Am', 9, 'm'],
    ['Amin', 9, 'm'],
    ['A-', 9, 'm'],
    ['G7', 7, '7'],
    ['Em7', 4, 'm7'],
    ['Emin7', 4, 'm7'],
    ['E-7', 4, 'm7'],
    ['Fmaj7', 5, 'maj7'],
    ['FM7', 5, 'maj7'],
    ['Dsus2', 2, 'sus2'],
    ['Dsus4', 2, 'sus4'],
    ['Dsus', 2, 'sus4'],
    ['Bdim', 11, 'dim'],
    ['Bo', 11, 'dim'],
    ['Cadd9', 0, 'add9'],
    ['A6', 9, '6'],
    ['F#m', 6, 'm'],
    ['Bbmaj7', 10, 'maj7'],
    ['Ebm7', 3, 'm7'],
  ])('%s → pc %i, %s (exact)', (token, pc, quality) => {
    expect(parseChord(token)).toEqual({ label: { pc, quality }, approx: false });
  });

  it.each([
    ['G9', '7'],
    ['G11', '7'],
    ['G13', '7'],
    ['G7sus4', '7'],
    ['Am9', 'm7'],
    ['Am11', 'm7'],
    ['Cmaj9', 'maj7'],
    ['Bdim7', 'dim'],
    ['Bm7b5', 'dim'],
    ['Am6', 'm'],
    ['E5', 'maj'],
    ['Caug', 'maj'],
    ['C+', 'maj'],
    ['Cmmaj7', 'm'],
    ['Cweird', 'maj'],
  ])('%s maps to the nearest supported quality %s (approx)', (token, quality) => {
    const parsed = parseChord(token);
    expect(parsed?.label.quality).toBe(quality);
    expect(parsed?.approx).toBe(true);
  });

  it('reads slash chords', () => {
    expect(parseChord('D/F#')).toEqual({
      label: { pc: 2, quality: 'maj', bassPc: 6 },
      approx: false,
    });
    expect(parseChord('Am/G')).toEqual({
      label: { pc: 9, quality: 'm', bassPc: 7 },
      approx: false,
    });
  });

  it('drops a slash bass that is the root', () => {
    expect(parseChord('C/C')).toEqual({
      label: { pc: 0, quality: 'maj' },
      approx: false,
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseChord('  G  ')?.label).toEqual({ pc: 7, quality: 'maj' });
  });

  it.each(['', 'H', 'x', 'g', 'C/H', 'C/', '/C', '|'])(
    'returns null for %j',
    (token) => {
      expect(parseChord(token)).toBeNull();
    },
  );
});

describe('chordName', () => {
  it.each([
    [{ pc: 0, quality: 'maj' }, 'C'],
    [{ pc: 9, quality: 'm' }, 'Am'],
    [{ pc: 10, quality: 'maj7' }, 'Bbmaj7'],
    [{ pc: 6, quality: 'm7' }, 'F#m7'],
    [{ pc: 3, quality: 'sus4' }, 'Ebsus4'],
    [{ pc: 2, quality: 'maj', bassPc: 6 }, 'D/F#'],
    [{ pc: 1, quality: '7' }, 'C#7'],
    [{ pc: 8, quality: 'dim' }, 'Abdim'],
  ] as const)('%j → %s', (label, name) => {
    expect(chordName(label)).toBe(name);
  });

  it('round-trips through parseChord for every root and quality', () => {
    const qualities = [
      'maj',
      'm',
      '7',
      'm7',
      'maj7',
      'sus2',
      'sus4',
      'dim',
      'add9',
      '6',
    ] as const;
    for (let pc = 0; pc < 12; pc++) {
      for (const quality of qualities) {
        const label = { pc, quality };
        expect(parseChord(chordName(label))?.label).toEqual(label);
      }
    }
  });
});

describe('chordTones', () => {
  it.each([
    [{ pc: 0, quality: 'maj' }, [0, 4, 7]],
    [{ pc: 9, quality: 'm' }, [0, 4, 9]],
    [{ pc: 7, quality: '7' }, [2, 5, 7, 11]],
    [{ pc: 0, quality: 'add9' }, [0, 2, 4, 7]],
    [{ pc: 11, quality: 'dim' }, [2, 5, 11]],
    [{ pc: 2, quality: 'maj', bassPc: 6 }, [2, 6, 9]],
    [{ pc: 9, quality: 'm', bassPc: 7 }, [0, 4, 7, 9]],
  ] as const)('%j → %j', (label, tones) => {
    expect([...chordTones(label)].sort((a, b) => a - b)).toEqual(tones);
  });
});

describe('transpose', () => {
  it('moves root and bass, wrapping around the octave', () => {
    expect(transpose({ pc: 2, quality: 'maj', bassPc: 6 }, -3)).toEqual({
      pc: 11,
      quality: 'maj',
      bassPc: 3,
    });
    expect(transpose({ pc: 11, quality: 'm' }, 2)).toEqual({ pc: 1, quality: 'm' });
  });
});
