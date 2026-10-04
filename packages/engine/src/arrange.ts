import { bestCapo } from './capo.js';
import { chordName, transpose } from './chords.js';
import { TICKS_PER_BEAT } from './constants.js';
import { LEVELS, getPattern, patternsFor } from './patterns/index.js';
import { type ChordSpan, isPlayable, runSegment } from './runner.js';
import type {
  AnalysisResult,
  ArrangeOptions,
  Arrangement,
  BeatsPerBar,
  ChordLabel,
  ChordMark,
  Level,
  NoteEvent,
  PatternDef,
  Style,
  Voicing,
  WarningCode,
} from './types.js';
import { getVoicing } from './voicings.js';

/**
 * Patterns to try for each chord, best first: the chosen pattern, the other
 * patterns at the same level, then each level below (engine-spec §4).
 */
export function patternCandidates(
  style: Style,
  level: Level,
  beatsPerBar: BeatsPerBar,
  patternId?: string,
): PatternDef[] {
  const sameLevel = patternsFor(style, level, beatsPerBar);
  let first = sameLevel[0];
  if (patternId !== undefined) {
    const requested = getPattern(patternId);
    if (!requested) throw new Error(`Unknown pattern "${patternId}"`);
    if (requested.style !== style || requested.level !== level) {
      throw new Error(`Pattern "${patternId}" is not a ${style} ${level} pattern`);
    }
    if (!requested.meters.includes(beatsPerBar)) {
      throw new Error(`Pattern "${patternId}" doesn't support ${beatsPerBar}-beat bars`);
    }
    first = requested;
  }
  if (!first) throw new Error(`No ${style} ${level} pattern for ${beatsPerBar}-beat bars`);

  const lower = LEVELS.slice(0, LEVELS.indexOf(level))
    .reverse()
    .flatMap((l) => patternsFor(style, l, beatsPerBar));
  return [first, ...sameLevel.filter((p) => p !== first), ...lower];
}

/** Whether the pattern's `requires` allow this voicing. */
export function meetsRequirements(pattern: PatternDef, voicing: Voicing): boolean {
  const req = pattern.requires;
  if (!req) return true;
  if (req.maxFret !== undefined && Math.max(...voicing.frets) > req.maxFret) return false;
  // Open treble: the top string rings open, so patterns can lean on it.
  if (req.openTreble && voicing.frets[5] !== 0) return false;
  return true;
}

/** Notes for one chord from the first candidate that fits and is playable. */
export function renderSpan(
  candidates: readonly PatternDef[],
  span: ChordSpan,
  beatsPerBar: BeatsPerBar,
): NoteEvent[] {
  for (const pattern of candidates) {
    if (!meetsRequirements(pattern, span.voicing)) continue;
    const notes = runSegment(pattern, span, beatsPerBar);
    if (isPlayable(notes, span.voicing)) return notes;
  }
  // Nothing fits: keep the chosen pattern rather than going silent.
  return runSegment(candidates[0], span, beatsPerBar);
}

class Warnings {
  readonly list: Arrangement['warnings'] = [];
  private seen = new Set<string>();

  add(code: WarningCode, message: string) {
    if (this.seen.has(message)) return;
    this.seen.add(message);
    this.list.push({ code, message });
  }
}

function resolveCapo(capo: ArrangeOptions['capo'], chords: ChordLabel[]): number {
  if (capo === undefined || capo === 'auto') return bestCapo(chords);
  if (!Number.isInteger(capo) || capo < 0 || capo > 12) {
    throw new Error(`Capo must be a fret from 0 to 12, got ${capo}`);
  }
  return capo;
}

/** engine-spec §3: AnalysisResult + style + level → playable Arrangement. */
export function arrange(input: AnalysisResult, opts: ArrangeOptions): Arrangement {
  const { beatsPerBar } = input.meter;
  const barTicks = beatsPerBar * TICKS_PER_BEAT;
  const candidates = patternCandidates(opts.style, opts.level, beatsPerBar, opts.patternId);

  const segments = input.chords;
  const bars = segments.length ? segments[segments.length - 1].bar + 1 : 0;
  const songEnd = bars * barTicks;
  const tickOf = (s: { bar: number; beat: number }) => s.bar * barTicks + s.beat * TICKS_PER_BEAT;

  const chords = segments.flatMap((s) => (s.chord ? [s.chord] : []));
  const capo = resolveCapo(opts.capo, chords);

  const warnings = new Warnings();
  const chordMarks: ChordMark[] = [];
  const events: NoteEvent[] = [];

  segments.forEach((segment, i) => {
    if (!segment.chord) return;
    const start = tickOf(segment);
    const end = i + 1 < segments.length ? tickOf(segments[i + 1]) : songEnd;
    if (end <= start) return;

    const asked = segment.chord;
    const { voicing, played, slashDropped, unsupported } = getVoicing(
      transpose(asked, -capo),
      opts.level,
    );
    const askedName = chordName(asked);
    const soundingName = chordName(transpose(played, capo));

    if (voicing.simplified) {
      warnings.add(
        'simplified',
        `Swapped ${voicing.simplified.from} for ${voicing.name} so you can skip the barre.`,
      );
    }
    if (voicing.barre) {
      warnings.add('barre', `${voicing.name} needs a barre at this capo position.`);
    }
    if (unsupported) warnings.add('unsupported-chord', `Playing ${askedName} as ${soundingName}.`);
    if (slashDropped) {
      warnings.add('slash-dropped', `Playing ${askedName} without the separate bass note.`);
    }

    chordMarks.push({ tick: start, voicing, soundingName });
    events.push(...renderSpan(candidates, { start, end, voicing, played }, beatsPerBar));
  });

  events.sort((a, b) => a.tick - b.tick || a.string - b.string);

  return {
    style: opts.style,
    level: opts.level,
    patternId: candidates[0].id,
    capo,
    meter: input.meter,
    bpm: input.bpm,
    bars,
    chordMarks,
    events,
    warnings: warnings.list,
  };
}
