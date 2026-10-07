import { arrange } from '@thumbline/engine';
import type { AnalysisResult } from '@thumbline/engine';
import { sheetSections, songTitle, warningSummary } from './sheet-view';

describe('songTitle', () => {
  it('drops the extension, underscores and a download site tag', () => {
    expect(songTitle('Glass_animal_-_Heat_Waves_(mp3.pm).mp3')).toBe('Glass animal - Heat Waves');
    expect(songTitle('Husn - Anuv Jain.m4a')).toBe('Husn - Anuv Jain');
    expect(songTitle('(Titanic Theme) My Heart Will Go On - Sungha Jung.mp3')).toBe('(Titanic Theme) My Heart Will Go On - Sungha Jung');
  });
});

describe('sheetSections', () => {
  const song = (chart: string[]): AnalysisResult => ({
    version: 1,
    durationSec: chart.length * 4 * (60 / 90),
    bpm: 90,
    beatTimesSec: Array.from({ length: chart.length * 4 }, (_, i) => (i * 60) / 90),
    barStartBeat: 0,
    meter: { beatsPerBar: 4 },
    key: { pc: 0, mode: 'major' },
    chords: chart.map((name, bar) => ({ bar, beat: 0, chord: { pc: { C: 0, F: 5, G: 7, A: 9 }[name] ?? 0, quality: 'maj' as const }, confidence: 1, alternatives: [] })),
  });

  it('letters repeated runs of chords, with their bar ranges', () => {
    const verse = ['C', 'G', 'A', 'F', 'C', 'G', 'F', 'C'];
    const chorus = ['F', 'G', 'C', 'A', 'F', 'G', 'C', 'C'];
    expect(sheetSections(song([...verse, ...chorus, ...verse])).map((s) => [s.title, s.detail])).toEqual([
      ['Section A', 'Bars 1–8'],
      ['Section B', 'Bars 9–16'],
      ['Section A', 'Bars 17–24'],
    ]);
  });

  it('covers every bar once', () => {
    const input = song(['C', 'G', 'A', 'F', 'C', 'G', 'F', 'C', 'F', 'G']);
    const a = arrange(input, { style: 'arpeggio', level: 'basic', capo: 0 });
    const s = sheetSections(input);
    expect(s.reduce((n, x) => n + x.bars, 0)).toBe(a.bars);
    s.forEach((x, i) => i && expect(x.firstBar).toBe(s[i - 1].firstBar + s[i - 1].bars));
  });
});

describe('warningSummary', () => {
  it('says how many chords were changed and why, in one line', () => {
    const w = (code: string, message: string) => ({ code, message }) as const;
    expect(
      warningSummary([w('simplified', 'a'), w('simplified', 'b'), w('simplified', 'c'), w('barre', 'd'), w('barre', 'e')] as never),
    ).toBe('3 chords are simplified and 2 chords need a barre.');
    expect(warningSummary([w('barre', 'd')] as never)).toBe('1 chord needs a barre.');
    expect(warningSummary([])).toBeUndefined();
  });
});
