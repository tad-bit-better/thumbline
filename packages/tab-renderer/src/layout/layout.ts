import type { Arrangement, Finger } from '@thumbline/engine';

/** engine-spec conventions: 480 ticks per beat. */
const TICKS_PER_BEAT = 480;
const EIGHTH = TICKS_PER_BEAT / 2;
const SIXTEENTH = TICKS_PER_BEAT / 4;
const MAX_BARS_PER_SYSTEM = 4;

/** Sheet geometry in px. Lanes from the top: chords, techniques, strings, fingers. */
export const GEOMETRY = {
  left: 30,
  right: 4,
  barPad: 10,
  chordLane: 30,
  techLane: 22,
  stringGap: 14,
  stringTop: 60,
  fingerLane: 24,
  systemHeight: 162,
  systemGap: 24,
  /** Narrowest readable column for eighth and sixteenth grids. */
  minColWidth: { [EIGHTH]: 26, [SIXTEENTH]: 20 } as Record<number, number>,
} as const;

export type NoteLayout = {
  eventIndex: number;
  x: number;
  y: number;
  text: string;
  /** Thumb notes sit on a violet-soft chip. */
  bass: boolean;
  /** Notes of the tune stand out (orange chip, bold). */
  melody: boolean;
};

export type TechMark =
  | { kind: 'slur'; label: 'h' | 'p'; x1: number; x2: number; y: number }
  | { kind: 'accent'; x: number }
  | { kind: 'rasgueo'; direction: 'down' | 'up'; x: number; y1: number; y2: number }
  /** A slow strum (fingerstyle brush): a wavy roll line with the stroke's arrow */
  | { kind: 'brush'; direction: 'down' | 'up'; x: number; y1: number; y2: number }
  | { kind: 'golpe' | 'slap' | 'apagado'; x: number }
  | { kind: 'palm-mute'; x: number }
  | { kind: 'pinch'; x: number; y1: number; y2: number }
  | { kind: 'apoyando'; x: number; y: number }
  | { kind: 'tremolo'; x: number; y: number };

export type SystemLayout = {
  index: number;
  firstBar: number;
  barCount: number;
  /** Top of the system within the sheet. */
  y: number;
  /** Ticks covered: [start, end). */
  start: number;
  end: number;
  barLines: number[];
  /** Indexed by string (0 = low E). */
  stringY: number[];
  notes: NoteLayout[];
  chords: Array<{ tick: number; x: number; name: string; sounding?: string }>;
  fingers: Array<{ x: number; text: string }>;
  techniques: TechMark[];
};

export type SheetLayout = {
  width: number;
  height: number;
  /** Ticks per column: an eighth, or a sixteenth when the pattern needs it. */
  step: number;
  barTicks: number;
  colWidth: number;
  barWidth: number;
  barsPerSystem: number;
  systems: SystemLayout[];
  /** Playhead position for each event index. */
  positions: Array<{ system: number; x: number }>;
};

/** Golpe chip half-width (8) plus the accent's half-width (4) and a 1 px gap. */
const ACCENT_BESIDE_GOLPE = 13;

const STRING_Y = Array.from({ length: 6 }, (_, s) => GEOMETRY.stringTop + (5 - s) * GEOMETRY.stringGap);

export type LayoutOptions = {
  /** Fix the bars per system (bar cards use 1); otherwise 1–4, as many as fit. */
  barsPerSystem?: number;
};

/** Pure layout of an arrangement for a given width; wraps 1–4 bars per system. */
export function layoutSheet(a: Arrangement, width: number, options: LayoutOptions = {}): SheetLayout {
  const G = GEOMETRY;
  const barTicks = a.meter.beatsPerBar * TICKS_PER_BEAT;
  const step = a.events.every((e) => e.tick % EIGHTH === 0) ? EIGHTH : SIXTEENTH;
  const cols = barTicks / step;
  const minBar = cols * G.minColWidth[step] + 2 * G.barPad;
  const usable = width - G.left - G.right;
  const barsPerSystem = options.barsPerSystem ?? Math.max(1, Math.min(MAX_BARS_PER_SYSTEM, Math.floor(usable / minBar)));
  const sheetWidth = Math.max(width, G.left + G.right + minBar * barsPerSystem);
  const barWidth = (sheetWidth - G.left - G.right) / barsPerSystem;
  const colWidth = (barWidth - 2 * G.barPad) / cols;

  const systemCount = Math.ceil(a.bars / barsPerSystem);
  const systems: SystemLayout[] = Array.from({ length: systemCount }, (_, i) => {
    const firstBar = i * barsPerSystem;
    const barCount = Math.min(barsPerSystem, a.bars - firstBar);
    return {
      index: i,
      firstBar,
      barCount,
      y: i * (G.systemHeight + G.systemGap),
      start: firstBar * barTicks,
      end: (firstBar + barCount) * barTicks,
      barLines: Array.from({ length: barCount + 1 }, (_, k) => G.left + k * barWidth),
      stringY: STRING_Y,
      notes: [],
      chords: [],
      fingers: [],
      techniques: [],
    };
  });

  const place = (tick: number) => {
    const bar = Math.floor(tick / barTicks);
    const system = Math.floor(bar / barsPerSystem);
    const inBar = tick - bar * barTicks;
    const x = G.left + (bar - system * barsPerSystem) * barWidth + G.barPad + (inBar / step + 0.5) * colWidth;
    return { system, x };
  };

  const positions: SheetLayout['positions'] = [];
  const lastOnString: Array<{ system: number; x: number } | undefined> = [];
  const accented = new Set<string>();
  const groups = new Map<string, { kind: 'rasgueo' | 'brush' | 'pinch'; system: number; x: number; lo: number; hi: number; n: number; direction: 'down' | 'up' }>();
  let column: { tick: number; system: number; x: number; fingers: Finger[] } | undefined;
  const flushColumn = () => {
    if (column) systems[column.system].fingers.push({ x: column.x, text: column.fingers.join('') });
  };

  a.events.forEach((e, i) => {
    const pos = place(e.tick);
    positions.push(pos);
    const sys = systems[pos.system];
    if (!sys) return;
    const y = STRING_Y[e.string];

    if (!column || column.tick !== e.tick) {
      flushColumn();
      column = { tick: e.tick, system: pos.system, x: pos.x, fingers: [] };
    }
    // A strum is one stroke: list each finger once per column.
    if (!column.fingers.includes(e.finger)) column.fingers.push(e.finger);

    if (e.fret < 0) {
      sys.techniques.push({ kind: e.tech === 'slap' || e.tech === 'apagado' ? e.tech : 'golpe', x: pos.x });
      return;
    }
    // A thumb strum (alzapúa) is a stroke, not a bass note: no bass chip.
    const strum = e.tech === 'rasgueo-down' || e.tech === 'rasgueo-up' || e.tech === 'brush-down' || e.tech === 'brush-up';
    // A natural harmonic is written as its node fret in angle brackets: <12>.
    const text = e.tech === 'harmonic' ? `<${e.fret}>` : String(e.fret);
    sys.notes.push({ eventIndex: i, x: pos.x, y, text, bass: e.finger === 'p' && !strum, melody: e.melody === true });

    if (e.accent && !accented.has(`${e.tick}`)) {
      accented.add(`${e.tick}`);
      sys.techniques.push({ kind: 'accent', x: pos.x });
    }
    switch (e.tech) {
      case 'hammer':
      case 'pull': {
        const prev = lastOnString[e.string];
        const x1 = prev && prev.system === pos.system ? prev.x : G.left;
        sys.techniques.push({ kind: 'slur', label: e.tech === 'hammer' ? 'h' : 'p', x1, x2: pos.x, y });
        break;
      }
      case 'apoyando':
      case 'tremolo':
        sys.techniques.push({ kind: e.tech, x: pos.x, y });
        break;
      case 'palm-mute':
        sys.techniques.push({ kind: 'palm-mute', x: pos.x });
        break;
      case 'rasgueo-down':
      case 'rasgueo-up':
      case 'brush-down':
      case 'brush-up':
      case 'pinch': {
        const kind = e.tech === 'pinch' ? 'pinch' : e.tech.startsWith('brush') ? 'brush' : 'rasgueo';
        const key = `${kind}:${e.tick}`;
        const g = groups.get(key);
        if (g) {
          g.lo = Math.min(g.lo, e.string);
          g.hi = Math.max(g.hi, e.string);
          g.n++;
        } else {
          groups.set(key, {
            kind,
            system: pos.system,
            x: pos.x,
            lo: e.string,
            hi: e.string,
            n: 1,
            direction: e.tech === 'rasgueo-up' || e.tech === 'brush-up' ? 'up' : 'down',
          });
        }
        break;
      }
    }
    lastOnString[e.string] = pos;
  });
  flushColumn();

  // An accent on a golpe's beat sits just right of the golpe chip, not on top of it.
  for (const sys of systems) {
    const golpes = new Set(sys.techniques.flatMap((t) => (t.kind === 'golpe' || t.kind === 'slap' || t.kind === 'apagado' ? [t.x] : [])));
    for (const t of sys.techniques) if (t.kind === 'accent' && golpes.has(t.x)) t.x += ACCENT_BESIDE_GOLPE;
  }

  for (const g of groups.values()) {
    const [y1, y2] = [STRING_Y[g.hi], STRING_Y[g.lo]];
    if (g.kind === 'rasgueo' || g.kind === 'brush') systems[g.system].techniques.push({ kind: g.kind, direction: g.direction, x: g.x, y1, y2 });
    else if (g.n > 1) systems[g.system].techniques.push({ kind: 'pinch', x: g.x, y1, y2 });
  }

  for (const m of a.chordMarks) {
    const pos = place(m.tick);
    const sys = systems[pos.system];
    if (!sys) continue;
    const sounding = a.capo > 0 && m.soundingName !== m.voicing.name ? m.soundingName : undefined;
    sys.chords.push({ tick: m.tick, x: pos.x - colWidth / 2, name: m.voicing.name, sounding });
  }

  const height = systemCount ? systemCount * G.systemHeight + (systemCount - 1) * G.systemGap : 0;
  return { width: sheetWidth, height, step, barTicks, colWidth, barWidth, barsPerSystem, systems, positions };
}

/**
 * The tick under `x` in a system: the start of the column there, clamped to
 * the system's bars. Inverse of where notes are placed. Null left of the first bar line.
 */
export function tickAtX(layout: SheetLayout, system: SystemLayout, x: number): number | null {
  const G = GEOMETRY;
  if (x < G.left) return null;
  const bar = Math.min(system.barCount - 1, Math.floor((x - G.left) / layout.barWidth));
  const inBar = x - G.left - bar * layout.barWidth - G.barPad;
  const cols = layout.barTicks / layout.step;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(inBar / layout.colWidth)));
  return (system.firstBar + bar) * layout.barTicks + col * layout.step;
}
