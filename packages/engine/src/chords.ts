import type { ChordLabel, Quality } from './types.js';

const NATURAL_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Display names per pitch class: sharps for C#/F#, flats elsewhere. */
const DISPLAY = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const SUFFIX: Record<Quality, string> = {
  maj: '',
  m: 'm',
  '7': '7',
  m7: 'm7',
  maj7: 'maj7',
  sus2: 'sus2',
  sus4: 'sus4',
  dim: 'dim',
  add9: 'add9',
  '6': '6',
};

/** Intervals above the root, in semitones. */
export const QUALITY_INTERVALS: Record<Quality, readonly number[]> = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  add9: [0, 4, 7, 2],
  '6': [0, 4, 7, 9],
};

/** Suffix spellings → quality. `approx` marks chords we play as a simpler one. */
const QUALITY_MAP: Array<[RegExp, Quality, boolean]> = [
  [/^(|maj|M)$/, 'maj', false],
  [/^(m|min|-)$/, 'm', false],
  [/^7$/, '7', false],
  [/^(m7|min7|-7)$/, 'm7', false],
  [/^(maj7|M7)$/, 'maj7', false],
  [/^sus2$/, 'sus2', false],
  [/^(sus4|sus)$/, 'sus4', false],
  [/^(dim|o)$/, 'dim', false],
  [/^add9$/, 'add9', false],
  [/^6$/, '6', false],
  [/^(9|11|13|7sus4)$/, '7', true],
  [/^(m9|m11|min9)$/, 'm7', true],
  [/^(maj9|M9)$/, 'maj7', true],
  [/^(dim7|o7|m7b5)$/, 'dim', true],
  [/^m6$/, 'm', true],
  [/^(5|aug|\+)$/, 'maj', true],
];

const CHORD_RE = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/;

export type ParsedChord = { label: ChordLabel; approx: boolean };

/** Pitch class of a note name such as `C`, `F#` or `Bb`; null if it isn't one. */
export function pcOf(name: string): number | null {
  const m = /^([A-G])([#b]?)$/.exec(name);
  if (!m) return null;
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (NATURAL_PC[m[1]] + shift + 12) % 12;
}

function normaliseQuality(suffix: string): { quality: Quality; approx: boolean } {
  for (const [re, quality, approx] of QUALITY_MAP) {
    if (re.test(suffix)) return { quality, approx };
  }
  if (/^(m|min)/.test(suffix) && !/^maj/.test(suffix)) {
    return { quality: 'm', approx: true };
  }
  return { quality: 'maj', approx: true };
}

/**
 * Parse a chord symbol such as `Am7`, `Bbmaj7` or `D/F#`.
 * Unknown suffixes map to the nearest supported quality with `approx: true`.
 * Returns null when the token isn't a chord symbol at all.
 */
export function parseChord(token: string): ParsedChord | null {
  const m = CHORD_RE.exec(token.trim());
  if (!m) return null;
  const pc = pcOf(m[1] + m[2]) as number;
  const { quality, approx } = normaliseQuality(m[3]);
  const label: ChordLabel = { pc, quality };
  if (m[4]) {
    const bassPc = pcOf(m[4] + m[5]) as number;
    if (bassPc !== pc) label.bassPc = bassPc;
  }
  return { label, approx };
}

export function chordName(label: ChordLabel): string {
  const bass = label.bassPc === undefined ? '' : `/${DISPLAY[label.bassPc]}`;
  return DISPLAY[label.pc] + SUFFIX[label.quality] + bass;
}

/** Pitch classes that belong to the chord, including a slash bass. */
export function chordTones(label: ChordLabel): Set<number> {
  const tones = new Set(QUALITY_INTERVALS[label.quality].map((i) => (label.pc + i) % 12));
  if (label.bassPc !== undefined) tones.add(label.bassPc);
  return tones;
}

/** Move a chord by `semitones` (negative = down). */
export function transpose(label: ChordLabel, semitones: number): ChordLabel {
  const shift = (pc: number) => (((pc + semitones) % 12) + 12) % 12;
  const out: ChordLabel = { pc: shift(label.pc), quality: label.quality };
  if (label.bassPc !== undefined) out.bassPc = shift(label.bassPc);
  return out;
}
