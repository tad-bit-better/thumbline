// Words and option lists the Sheet screen shows (screens.md §4).
import type { Style } from '@thumbline/engine';

export const KEYS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];
export const STYLE_NAMES: Record<Style, string> = {
  arpeggio: 'Arpeggio',
  fingerstyle: 'Fingerstyle',
  flamenco: 'Flamenco',
};
export const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;
export const STYLE_OPTIONS = [
  { value: 'arpeggio', label: 'Arpeggio' },
  { value: 'fingerstyle', label: 'Fingerstyle' },
  { value: 'flamenco', label: 'Flamenco' },
] as const;
export const STYLE_HINTS: Record<Style, string> = {
  arpeggio: 'Rolling patterns that let every note of the chord ring.',
  fingerstyle: 'A steady thumb with the fingers playing around it.',
  flamenco: 'Rumba and tangos with rasgueado and golpe.',
};
export const PALOS = [
  { value: 'rumba', label: 'Rumba' },
  { value: 'tangos', label: 'Tangos' },
] as const;
export const METERS = [
  { value: '4', label: '4/4' },
  { value: '3', label: '3/4' },
] as const;
export const TEMPO_SCALES = [
  { value: '0.5', label: 'Half' },
  { value: '1', label: 'As heard' },
  { value: '2', label: 'Double' },
] as const;
export const CHORD_NAME_OPTIONS = [
  { value: 'shape', label: 'Shape' },
  { value: 'sounding', label: 'Sounding' },
  { value: 'both', label: 'Both' },
] as const;
export const TAB_SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
] as const;
export const MIX_TEXT = {
  sheet: 'sheet only',
  original: 'original only',
  both: 'sheet and original',
} as const;
export const FULLNESS_NOTE =
  'Higher fills the pauses in the tune and adds harmony under it. It never plays faster.';

/** What a screen reader says for a fullness setting. */
export const fullnessWords = (f: number) =>
  `${f} of 10, ${f <= 2 ? 'sparse' : f <= 4 ? 'light' : f <= 6 ? 'as written' : f <= 8 ? 'fuller' : 'full'}`;

export const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** "Fingerstyle (Rumba)": the style with its palo, if any. */
export const styleLabel = (style: Style, palo?: string) =>
  STYLE_NAMES[style] +
  (palo ? ` (${PALOS.find((p) => p.value === palo)?.label})` : '');
export const levelLabel = (level: string) =>
  LEVELS.find((l) => l.value === level)?.label;
