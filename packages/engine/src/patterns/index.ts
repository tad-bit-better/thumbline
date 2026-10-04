import type { BeatsPerBar, Level, Palo, PatternDef, Style } from '../types.js';
import { ARPEGGIO_PATTERNS } from './arpeggio.js';
import { FINGERSTYLE_PATTERNS } from './fingerstyle.js';
import { FLAMENCO_PATTERNS } from './flamenco.js';

export const PATTERNS: readonly PatternDef[] = [...ARPEGGIO_PATTERNS, ...FINGERSTYLE_PATTERNS, ...FLAMENCO_PATTERNS];

/** The palos v1 plays (PLAN M7); the others are in the type for later. */
export const PALOS: readonly Palo[] = ['rumba', 'tangos'];

export const LEVELS: readonly Level[] = ['basic', 'moderate', 'advanced'];

export function getPattern(id: string): PatternDef | undefined {
  return PATTERNS.find((p) => p.id === id);
}

/**
 * Patterns for a style and level, in display order; optionally only those
 * that support a meter, and (flamenco) those for a palo.
 */
export function patternsFor(style: Style, level: Level, beatsPerBar?: BeatsPerBar, palo?: Palo): PatternDef[] {
  return PATTERNS.filter(
    (p) =>
      p.style === style &&
      p.level === level &&
      (beatsPerBar === undefined || p.meters.includes(beatsPerBar)) &&
      (palo === undefined || !p.palos || p.palos.includes(palo)),
  );
}
