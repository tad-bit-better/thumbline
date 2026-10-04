import type { BeatsPerBar, Level, PatternDef, Style } from '../types.js';
import { ARPEGGIO_PATTERNS } from './arpeggio.js';
import { FINGERSTYLE_PATTERNS } from './fingerstyle.js';

export const PATTERNS: readonly PatternDef[] = [...ARPEGGIO_PATTERNS, ...FINGERSTYLE_PATTERNS];

export const LEVELS: readonly Level[] = ['basic', 'moderate', 'advanced'];

export function getPattern(id: string): PatternDef | undefined {
  return PATTERNS.find((p) => p.id === id);
}

/** Patterns for a style and level, in display order; optionally only those that support a meter. */
export function patternsFor(style: Style, level: Level, beatsPerBar?: BeatsPerBar): PatternDef[] {
  return PATTERNS.filter(
    (p) =>
      p.style === style &&
      p.level === level &&
      (beatsPerBar === undefined || p.meters.includes(beatsPerBar)),
  );
}
