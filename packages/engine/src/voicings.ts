import { chordName, parseChord } from './chords.js';
import { OPEN_PC } from './constants.js';
import type { ChordLabel, Frets, Level, Quality, Voicing } from './types.js';

export type LibraryEntry = { name: string; frets: Frets; barre: boolean };

/** Open-position shapes, in shape space (relative to the capo). */
export const LIBRARY: readonly LibraryEntry[] = [
  ['C', [-1, 3, 2, 0, 1, 0]],
  ['Cmaj7', [-1, 3, 2, 0, 0, 0]],
  ['C7', [-1, 3, 2, 3, 1, 0]],
  ['Cadd9', [-1, 3, 2, 0, 3, 0]],
  ['Csus2', [-1, 3, 0, 0, 1, 3]],
  ['Csus4', [-1, 3, 3, 0, 1, 1]],
  ['C6', [-1, 3, 2, 2, 1, 0]],
  ['D', [-1, -1, 0, 2, 3, 2]],
  ['Dm', [-1, -1, 0, 2, 3, 1]],
  ['D7', [-1, -1, 0, 2, 1, 2]],
  ['Dmaj7', [-1, -1, 0, 2, 2, 2]],
  ['Dm7', [-1, -1, 0, 2, 1, 1]],
  ['Dsus2', [-1, -1, 0, 2, 3, 0]],
  ['Dsus4', [-1, -1, 0, 2, 3, 3]],
  ['D6', [-1, -1, 0, 2, 0, 2]],
  ['E', [0, 2, 2, 1, 0, 0]],
  ['Em', [0, 2, 2, 0, 0, 0]],
  ['E7', [0, 2, 0, 1, 0, 0]],
  ['Em7', [0, 2, 0, 0, 0, 0]],
  ['Emaj7', [0, 2, 1, 1, 0, 0]],
  ['Esus4', [0, 2, 2, 2, 0, 0]],
  ['Eadd9', [0, 2, 2, 1, 0, 2]],
  ['F', [1, 3, 3, 2, 1, 1], true],
  ['Fmaj7', [-1, -1, 3, 2, 1, 0]],
  ['G', [3, 2, 0, 0, 0, 3]],
  ['G7', [3, 2, 0, 0, 0, 1]],
  ['Gmaj7', [3, 2, 0, 0, 0, 2]],
  ['Gsus4', [3, -1, 0, 0, 1, 3]],
  ['G6', [3, 2, 0, 0, 0, 0]],
  ['Gadd9', [3, -1, 0, 2, 0, 3]],
  ['Gsus2', [3, 0, 0, 0, 3, 3]],
  ['A', [-1, 0, 2, 2, 2, 0]],
  ['Am', [-1, 0, 2, 2, 1, 0]],
  ['A7', [-1, 0, 2, 0, 2, 0]],
  ['Am7', [-1, 0, 2, 0, 1, 0]],
  ['Amaj7', [-1, 0, 2, 1, 2, 0]],
  ['Asus2', [-1, 0, 2, 2, 0, 0]],
  ['Asus4', [-1, 0, 2, 2, 3, 0]],
  ['A6', [-1, 0, 2, 2, 2, 2]],
  ['Aadd9', [-1, 0, 2, 4, 2, 0]],
  ['B7', [-1, 2, 1, 2, 0, 2]],
  ['Bm', [-1, 2, 4, 4, 3, 2], true],
  ['Bm7', [-1, 2, 0, 2, 0, 2]],
  ['G/B', [-1, 2, 0, 0, 0, 3]],
  ['C/G', [3, 3, 2, 0, 1, 0]],
  ['D/F#', [2, -1, 0, 2, 3, 2]],
  ['C/E', [0, 3, 2, 0, 1, 0]],
  ['Am/G', [3, 0, 2, 2, 1, 0]],
  ['D/A', [-1, 0, 0, 2, 3, 2]],
].map(([name, frets, barre]) => ({
  name: name as string,
  frets: frets as Frets,
  barre: barre === true,
}));

const keyOf = (l: ChordLabel) => `${l.pc}:${l.quality}:${l.bassPc ?? ''}`;

const LIBRARY_BY_KEY = new Map<string, LibraryEntry & { label: ChordLabel }>(
  LIBRARY.map((e) => {
    const label = (parseChord(e.name) as { label: ChordLabel }).label;
    return [keyOf(label), { ...e, label }];
  }),
);

function libraryGet(label: ChordLabel) {
  return LIBRARY_BY_KEY.get(keyOf(label));
}

/** Basic level: qualities to try, in order, when the chord needs a barre. */
const SIMPLER: Record<Quality, Quality[]> = {
  maj: ['maj7', 'add9', 'sus2', '7'],
  m: ['m7'],
  '7': ['maj'],
  m7: ['m'],
  maj7: ['maj'],
  sus2: ['maj'],
  sus4: ['maj'],
  add9: ['maj'],
  '6': ['maj'],
  dim: [],
};

/** E-shape offsets from the root fret on string 0. */
const E_SHAPES: Partial<Record<Quality, Frets>> = {
  maj: [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, -1, 1, 1, 0, -1],
  sus4: [0, 2, 2, 2, 0, 0],
};

/** A-shape offsets from the root fret on string 1. */
const A_SHAPES: Partial<Record<Quality, Frets>> = {
  maj: [-1, 0, 2, 2, 2, 0],
  m: [-1, 0, 2, 2, 1, 0],
  '7': [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  dim: [-1, 0, 1, 2, 1, -1],
  '6': [-1, 0, 2, 2, 2, 2],
};

export function soundedPcs(frets: Frets): Set<number> {
  const pcs = new Set<number>();
  frets.forEach((f, s) => {
    if (f >= 0) pcs.add((OPEN_PC[s] + f) % 12);
  });
  return pcs;
}

/** Distance between the lowest and highest fretted note (open strings don't count). */
export function fretSpan(frets: readonly number[]): number {
  const fretted = frets.filter((f) => f > 0);
  return fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
}

/**
 * Lowest sounded string whose pitch class is the root;
 * for slash chords, the lowest sounded string.
 */
export function rootStringOf(frets: Frets, label: ChordLabel): number {
  const lowest = frets.findIndex((f) => f >= 0);
  if (label.bassPc !== undefined) return lowest;
  const root = frets.findIndex((f, s) => f >= 0 && (OPEN_PC[s] + f) % 12 === label.pc);
  return root === -1 ? lowest : root;
}

export type MovableVoicing = {
  name: string;
  frets: Frets;
  barre: boolean;
  /** Quality actually played: `maj` when the requested one has no movable shape. */
  quality: Quality;
};

/** E- or A-shape barre chord with the lowest root fret. */
export function movableVoicing(label: ChordLabel): MovableVoicing {
  const quality: Quality = E_SHAPES[label.quality] || A_SHAPES[label.quality] ? label.quality : 'maj';
  const options: Array<{ frets: Frets; rootFret: number }> = [];
  const add = (shape: Frets | undefined, openPc: number) => {
    if (!shape) return;
    const rootFret = (label.pc - openPc + 12) % 12;
    options.push({ frets: shape.map((o) => (o < 0 ? -1 : o + rootFret)) as Frets, rootFret });
  };
  add(A_SHAPES[quality], OPEN_PC[1]);
  add(E_SHAPES[quality], OPEN_PC[0]);
  options.sort((a, b) => a.rootFret - b.rootFret);
  const best = options[0];
  return {
    name: chordName({ pc: label.pc, quality }),
    frets: best.frets,
    barre: best.rootFret > 0,
    quality,
  };
}

export type VoicingResult = {
  voicing: Voicing;
  /** The chord the voicing actually sounds, in shape space. */
  played: ChordLabel;
  /** A slash chord was requested but its bass isn't in the shape. */
  slashDropped: boolean;
  /** The quality isn't playable as asked and was replaced by a major chord. */
  unsupported: boolean;
};

function fromEntry(
  entry: LibraryEntry & { label: ChordLabel },
  slashDropped: boolean,
  simplifiedFrom?: string,
): VoicingResult {
  const voicing: Voicing = {
    name: entry.name,
    frets: [...entry.frets],
    rootString: rootStringOf(entry.frets, entry.label),
    barre: entry.barre,
  };
  if (simplifiedFrom) voicing.simplified = { from: simplifiedFrom };
  return { voicing, played: entry.label, slashDropped, unsupported: false };
}

/**
 * Voicing for a chord in shape space. Lookup order (engine-spec §4):
 * slash chord in library → plain chord in library → (Basic) simpler open
 * quality → movable E/A shape with the lowest root fret.
 */
export function getVoicing(label: ChordLabel, level: Level): VoicingResult {
  const plain: ChordLabel = { pc: label.pc, quality: label.quality };
  const slash = label.bassPc !== undefined ? libraryGet(label) : undefined;
  const slashDropped = label.bassPc !== undefined && !slash;
  const found = slash ?? libraryGet(plain);

  if (level === 'basic' && (!found || found.barre)) {
    for (const quality of SIMPLER[label.quality]) {
      const alt = libraryGet({ pc: label.pc, quality });
      if (alt && !alt.barre) return fromEntry(alt, slashDropped, chordName(plain));
    }
  }
  if (found) return fromEntry(found, slashDropped);

  const movable = movableVoicing(plain);
  const played: ChordLabel = { pc: label.pc, quality: movable.quality };
  return {
    voicing: {
      name: movable.name,
      frets: movable.frets,
      rootString: rootStringOf(movable.frets, played),
      barre: movable.barre,
    },
    played,
    slashDropped,
    unsupported: movable.quality !== label.quality,
  };
}
