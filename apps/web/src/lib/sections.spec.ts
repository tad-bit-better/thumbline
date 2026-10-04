import { type BarSection, findSections, hasRepeats } from './sections';

/** The letter per bar, lower case where a phrase starts: "aAAAbBBB". */
const summary = (s: BarSection[]) => s.map((b) => (b.starts ? b.letter.toLowerCase() : b.letter)).join('');
const startLetters = (s: BarSection[]) => s.filter((b) => b.starts).map((b) => b.letter);

const verse = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'C'];
const chorus = ['C', 'G', 'D', 'Em', 'C', 'G', 'D', 'D'];

describe('findSections', () => {
  it('gives nothing for no bars', () => {
    expect(findSections([])).toEqual([]);
  });

  it('letters 8-bar phrases and reuses the letter of a repeat', () => {
    const s = findSections([...verse, ...chorus, ...verse, ...chorus]);
    expect(summary(s)).toBe('aAAAAAAA' + 'bBBBBBBB' + 'aAAAAAAA' + 'bBBBBBBB');
    expect(hasRepeats(s)).toBe(true);
  });

  it('allows one bar to differ', () => {
    const varied = [...verse.slice(0, 7), 'D'];
    const s = findSections([...verse, ...chorus, ...varied]);
    expect(startLetters(s)).toEqual(['A', 'B', 'A']);
  });

  it('does not match when two bars differ', () => {
    const varied = ['Am', ...verse.slice(1, 7), 'D'];
    const s = findSections([...verse, ...chorus, ...varied, ...verse]);
    expect(startLetters(s)).toEqual(['A', 'B', 'C', 'A']);
  });

  it('falls back to 4-bar phrases when no 8-bar phrase repeats', () => {
    // A 4-bar intro puts the loop half a phrase out.
    const intro = ['Am', 'Am', 'F', 'F'];
    const loop = ['G', 'D', 'Em', 'C'];
    const bridge = ['F', 'C', 'Dm', 'Bb'];
    const outro = ['Am', 'G', 'F', 'E'];
    const s = findSections([...intro, ...loop, ...loop, ...bridge, ...loop, ...outro]);
    expect(startLetters(s)).toEqual(['A', 'B', 'B', 'C', 'B', 'D']);
  });

  it('gives a song that never repeats one letter per 4-bar phrase', () => {
    const bars = 'C D E F G A B Cm Dm Em Fm Gm Am Bm C7 D7'.split(' ');
    const s = findSections(bars);
    expect(startLetters(s)).toEqual(['A', 'B', 'C', 'D']);
    expect(hasRepeats(s)).toBe(false);
  });

  it('matches a short last phrase against the start of an earlier one', () => {
    const s = findSections([...verse, ...chorus, ...verse.slice(0, 5)]);
    expect(summary(s).slice(16)).toBe('aAAAA');
  });

  it('needs a very short last phrase to match exactly', () => {
    const s = findSections([...verse, ...chorus, ...verse, 'Am', 'D']);
    expect(s.at(-2)).toEqual({ letter: 'C', starts: true });
    expect(s.at(-1)).toEqual({ letter: 'C', starts: false });
  });

  it('compares with the first phrase of a letter, so near-matches do not drift', () => {
    const a = ['C', 'C', 'C', 'C'];
    const a1 = ['D', 'C', 'C', 'C'];
    const a2 = ['D', 'D', 'C', 'C'];
    // No 8-bar repeat, so 4-bar phrases: a1 is one bar from a, a2 is two.
    const s = findSections([...a, ...a1, ...a2, 'E', 'E', 'E', 'E']);
    expect(startLetters(s)).toEqual(['A', 'A', 'B', 'C']);
  });

  it('keeps going past Z', () => {
    const bars = Array.from({ length: 27 * 4 }, (_, i) => `X${i}`);
    const letters = startLetters(findSections(bars));
    expect(letters[25]).toBe('Z');
    expect(letters[26]).toBe('A2');
  });

  it('treats a one-chord song as one repeated section', () => {
    const s = findSections(Array.from({ length: 16 }, () => 'E'));
    expect(summary(s)).toBe('aAAAAAAAaAAAAAAA');
  });
});
