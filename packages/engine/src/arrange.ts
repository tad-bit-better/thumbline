import { MAX_CAPO, bestCapo } from './capo.js';
import { chordName, transpose } from './chords.js';
import { TICKS_PER_BEAT } from './constants.js';
import { LEVELS, PALOS, getPattern, patternsFor } from './patterns/index.js';
import type { StringFret } from './bass.js';
import { type ChordSpan, isPlayable, runSegment } from './runner.js';
import { shapeDynamics } from './dynamics.js';
import { mergeMelody, placeMelody, quantiseMelody } from './melody.js';
import { applySections, applyTouch, moodLabelOf, moodValuesOf, sectionsOf } from './mood.js';
import { addChordRuns, addFills } from './fills.js';
import { addCounterLine, addEchoes } from './answers.js';
import { harmonise } from './harmony.js';
import { addRolls } from './rolls.js';
import { walkBass } from './walk.js';
import { DEFAULT_FULLNESS, type FullnessRules, checkFullness, fullnessRules } from './fullness.js';
import { moveTopLine } from './topline.js';
import type {
  AnalysisResult,
  ArrangeOptions,
  Arrangement,
  BeatsPerBar,
  ChordLabel,
  ChordMark,
  Level,
  NoteEvent,
  MoodLabel,
  Palo,
  PatternDef,
  SectionLevel,
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
  palo?: Palo,
  mood?: MoodLabel,
): PatternDef[] {
  const sameLevel = patternsFor(style, level, beatsPerBar, palo, mood);
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
    .flatMap((l) => patternsFor(style, l, beatsPerBar, palo, mood));
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

/** Flamenco needs a palo (default rumba); other styles ignore it. */
function resolvePalo(opts: ArrangeOptions): Palo | undefined {
  if (opts.style !== 'flamenco') return undefined;
  if (opts.palo === undefined) return 'rumba';
  if (!(PALOS as readonly string[]).includes(opts.palo)) throw new Error(`Unknown palo "${opts.palo}"; v1 plays ${PALOS.join(' and ')}`);
  return opts.palo as Palo;
}

/**
 * engine-spec §4, flamenco: put the Phrygian home chord on the E shape (E–F–G–Am),
 * else on the A shape if that needs a capo past 7. The home chord is a major chord
 * with another major chord a semitone above it (E with F), the commonest such;
 * failing that, the dominant of a minor key (E in A minor: the Andalusian cadence's
 * last chord). No home chord: the usual capo choice.
 */
export function flamencoCapo(chords: readonly ChordLabel[], key: AnalysisResult['key']): number {
  const major = (c: ChordLabel) => c.quality === 'maj' || c.quality === '7';
  const majors = new Set(chords.filter(major).map((c) => c.pc));
  const counts = new Map<number, number>();
  for (const c of chords) if (major(c) && majors.has((c.pc + 1) % 12)) counts.set(c.pc, (counts.get(c.pc) ?? 0) + 1);
  let home: number | undefined = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (home === undefined && key.mode === 'minor') home = (key.pc + 7) % 12;
  if (home === undefined) return bestCapo(chords);
  const onE = (home - 4 + 12) % 12;
  if (onE <= MAX_CAPO) return onE;
  return (home - 9 + 12) % 12; // A shape: A–Bb–C–Dm
}

function resolveCapo(capo: ArrangeOptions['capo'], chords: ChordLabel[]): number {
  if (capo === undefined || capo === 'auto') return bestCapo(chords);
  if (!Number.isInteger(capo) || capo < 0 || capo > 12) {
    throw new Error(`Capo must be a fret from 0 to 12, got ${capo}`);
  }
  return capo;
}

/** Bars a pattern plays before a steady stretch changes to its variant. */
const VARIATION_BARS = 8;

/**
 * engine-spec §4 vary by section (M11): which pattern plays each bar. Quiet
 * (soft) bars play the level's first purely calm pattern (moods only Sad and
 * Warm) when the main one isn't; full bars play the main pattern; a stretch of
 * normal bars plays the main pattern for 8 bars, then the level's next pattern
 * that suits the mood for 8, and so on. A pattern the user picked, flamenco,
 * and songs of 8 bars or fewer keep one pattern (undefined).
 */
export function patternPlan(candidates: readonly PatternDef[], level: Level, bars: number, sections: readonly SectionLevel[] | undefined, mood: MoodLabel | undefined): PatternDef[] | undefined {
  if (bars <= VARIATION_BARS || !candidates.length) return undefined;
  const main = candidates[0];
  const sameLevel = candidates.filter((p) => p.level === level);
  const suits = (p: PatternDef) => !mood || !p.moods || p.moods.includes(mood);
  const calmOnly = (p: PatternDef) => !!p.moods?.length && p.moods.every((m) => m === 'warm' || m === 'melancholic');
  const quiet = calmOnly(main) ? main : (sameLevel.find(calmOnly) ?? main);
  const variant = sameLevel.find((p) => p !== main && suits(p));
  const levelAt = (bar: number) => sections?.[bar] ?? 'normal';
  const plan: PatternDef[] = [];
  let runStart = 0;
  for (let bar = 0; bar < bars; bar++) {
    if (bar > 0 && levelAt(bar) !== levelAt(bar - 1)) runStart = bar;
    const here = levelAt(bar);
    if (here === 'soft') plan.push(quiet);
    else if (here === 'full') plan.push(main);
    else plan.push(variant && Math.floor((bar - runStart) / VARIATION_BARS) % 2 === 1 ? variant : main);
  }
  return plan;
}

/** engine-spec: MIDI of each open string (shape space). */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
/** Highest fret for a placed bass note. */
const SONG_BASS_MAX_FRET = 7;

/**
 * engine-spec §4 the song's bass (M11b): a bass note the shape doesn't have
 * (Cm over Ab), placed on string 0–2 at or below the shape's root string,
 * fret 7 at most, where the hand can hold it with the shape's top three strings
 * (§4 span and finger limits). Open strings first, then the fret nearest the
 * shape. None reachable: undefined (the caller warns and plays the root).
 */
export function placeSongBass(voicing: Voicing, bassPc: number): StringFret | undefined {
  const fretted = voicing.frets.filter((f) => f > 0);
  const centre = fretted.length ? (Math.min(...fretted) + Math.max(...fretted)) / 2 : 2;
  // Held with the strings the fingers play: the shape's top three above its root.
  const treble = voicing.frets.flatMap((fret, string) => (string > voicing.rootString && fret >= 0 ? [{ string, fret }] : [])).slice(-3);
  let best: { spot: StringFret; cost: number } | undefined;
  for (let string = 0; string <= Math.min(2, voicing.rootString); string++) {
    for (let fret = 0; fret <= SONG_BASS_MAX_FRET; fret++) {
      if ((OPEN_MIDI[string] + fret) % 12 !== bassPc) continue;
      const moment = [{ string, fret }, ...treble].map((n) => ({ tick: 0, dur: 1, finger: 'p' as const, velocity: 1, ...n }));
      if (!isPlayable(moment, voicing)) continue;
      const cost = fret === 0 ? 0 : 1 + Math.abs(fret - centre);
      if (!best || cost < best.cost) best = { spot: { string, fret }, cost };
    }
  }
  return best?.spot;
}

/**
 * engine-spec §4 fullness 1–2: while a tune note sounds, the pattern's finger
 * notes give way ('all'), or those off the beat ('offbeat'); the thumb stays.
 */
function thinUnderTune(notes: NoteEvent[], thinAt: (tick: number) => 'all' | 'offbeat' | null): NoteEvent[] {
  const tune = notes.filter((e) => e.melody);
  return notes.filter((e) => {
    const thin = thinAt(e.tick);
    if (!thin || e.melody || e.finger === 'p' || e.fret < 0) return true;
    if (thin === 'offbeat' && e.tick % TICKS_PER_BEAT === 0) return true;
    return !tune.some((t) => t.tick <= e.tick && e.tick < t.tick + t.dur);
  });
}

/** engine-spec §3: AnalysisResult + style + level → playable Arrangement. */
export function arrange(input: AnalysisResult, opts: ArrangeOptions): Arrangement {
  const { beatsPerBar } = input.meter;
  const barTicks = beatsPerBar * TICKS_PER_BEAT;
  const palo = resolvePalo(opts);
  const fullness = opts.fullness ?? DEFAULT_FULLNESS;
  checkFullness(fullness);
  // Section settings (§4): a later setting wins where two overlap.
  const settings = opts.sectionSettings ?? [];
  for (const s of settings) if (s.fullness !== undefined) checkFullness(s.fullness);
  const settingAt = (bar: number) => [...settings].reverse().find((s) => bar >= s.fromBar && bar < s.toBar);
  const rulesByFullness = new Map<number, FullnessRules>();
  /** The fullness rules for the bar holding `tick`. */
  const rulesAt = (tick: number): FullnessRules => {
    const f = settingAt(Math.floor(Math.max(0, tick) / barTicks))?.fullness ?? fullness;
    let r = rulesByFullness.get(f);
    if (!r) rulesByFullness.set(f, (r = fullnessRules(f, opts.level)));
    return r;
  };
  const full = rulesAt(0);
  const feel = opts.mood !== undefined ? moodValuesOf(opts.mood) : input.mood;
  const mood = feel ? moodLabelOf(feel) : undefined;
  const candidates = patternCandidates(opts.style, opts.level, beatsPerBar, opts.patternId, palo, mood);

  const segments = input.chords;
  const bars = segments.length ? segments[segments.length - 1].bar + 1 : 0;
  const songEnd = bars * barTicks;
  const tickOf = (s: { bar: number; beat: number }) => s.bar * barTicks + s.beat * TICKS_PER_BEAT;

  const chords = segments.flatMap((s) => (s.chord ? [s.chord] : []));
  const sections = input.beatEnergy?.length ? sectionsOf(input, beatsPerBar, bars) : undefined;
  let plan = opts.patternId === undefined && opts.style !== 'flamenco' ? patternPlan(candidates, opts.level, bars, sections, mood) : undefined;
  // A section's own pattern, when it's one for this style, level, meter and palo (a stale saved one is skipped).
  const allowed = patternsFor(opts.style, opts.level, beatsPerBar, palo);
  const ownPatterns = settings.flatMap((s) => {
    const p = s.patternId ? allowed.find((x) => x.id === s.patternId) : undefined;
    return p ? [{ ...s, pattern: p }] : [];
  });
  if (ownPatterns.length) {
    plan = plan ? [...plan] : Array.from({ length: bars }, () => candidates[0]);
    for (const s of ownPatterns) for (let bar = Math.max(0, s.fromBar); bar < Math.min(bars, s.toBar); bar++) plan[bar] = s.pattern;
  }
  const capo = opts.style === 'flamenco' && (opts.capo === undefined || opts.capo === 'auto') ? flamencoCapo(chords, input.key) : resolveCapo(opts.capo, chords);
  // The key of each bar (M10b: songs may change key), in shape space.
  const toShape = (key: AnalysisResult['key']) => ({ ...key, pc: (key.pc - capo + 12) % 12 });
  const shapeKeys = (input.keys?.length ? input.keys : [{ bar: 0, key: input.key }]).map((k) => ({ bar: k.bar, key: toShape(k.key) }));
  const shapeKeyAt = (bar: number) => shapeKeys.reduce((found, k) => (k.bar <= bar ? k.key : found), shapeKeys[0].key);

  const warnings = new Warnings();
  const chordMarks: ChordMark[] = [];
  const events: NoteEvent[] = [];
  const spans: ChordSpan[] = [];

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
    // No slash shape: the thumb plays the song's bass under the plain shape when the hand can reach it (M11b).
    const shapeAsked = transpose(asked, -capo);
    const songBass = slashDropped && shapeAsked.bassPc !== undefined ? placeSongBass(voicing, shapeAsked.bassPc) : undefined;
    if (slashDropped && !songBass) {
      warnings.add('slash-dropped', `Playing ${askedName} without the separate bass note.`);
    }

    chordMarks.push({ tick: start, voicing, soundingName });
    const span: ChordSpan = { start, end, voicing, played, key: shapeKeyAt(segment.bar), ...(songBass ? { bass: songBass } : {}) };
    spans.push(span);
    const chosen = plan?.[segment.bar] ?? candidates[0];
    events.push(...renderSpan(chosen === candidates[0] ? candidates : [chosen, ...candidates.filter((c) => c !== chosen)], span, beatsPerBar));
  });

  events.sort((a, b) => a.tick - b.tick || a.string - b.string);
  // A slow roll opens each phrase and ends the song (M11); flamenco has its own strums.
  // ...and the thumb walks into the next chord (M11).
  const rolled = opts.style === 'flamenco' ? events : walkBass(addRolls(events, spans, beatsPerBar, feel), spans, full.walk ?? 'basic', full.walkMinChord, rulesAt);
  // The tune on top (M9) when we have one; otherwise an invented top line (M6b).
  const tune = opts.melody !== false && input.melody?.length ? placeMelody(quantiseMelody(input, opts.level, songEnd, (tick) => rulesAt(tick).tuneGrid), spans, capo, opts.level) : [];
  let notes = rolled;
  // The tune on top, harmonised with the chord (M11).
  if (tune.length) notes = harmonise(thinUnderTune(mergeMelody(rolled, tune, spans), (tick) => rulesAt(tick).thin), spans, opts.level, beatsPerBar, (tick) => rulesAt(tick).harmony);
  // Where the tune rests, a short run into its next note (M11); flamenco keeps its own vocabulary.
  if (tune.length && opts.style !== 'flamenco') notes = addFills(notes, spans, opts.level, (tick) => {
      const r = rulesAt(tick);
      return { rest: r.fillRest, rhythms: r.fillRhythms, trim: r.fillTrim };
    });
  // Flamenco's top notes are strums, tremolo (one repeated note), drones and campanella: they stay put.
  else if (opts.style !== 'flamenco') moveTopLine(rolled, spans, opts.level, toShape(input.key));

  // The guitar answers the tune (§4 fullness 9–10): echoes in its pauses, a counter-line under held notes.
  if (tune.length && opts.style !== 'flamenco') {
    notes = addEchoes(notes, spans, (tick) => rulesAt(tick).echo);
    notes = addCounterLine(notes, spans, (tick) => rulesAt(tick).counterLine);
  }

  // Bars without a tune, asked to be fuller (§4 fullness 7+): a moving top line and runs into the chord changes.
  if (opts.style !== 'flamenco') {
    const sung = new Set<number>();
    for (const t of tune) for (let b = Math.floor(t.tick / barTicks); b * barTicks < t.tick + t.dur; b++) sung.add(b);
    const tuneless = (tick: number) => !sung.has(Math.floor(tick / barTicks));
    const quietSpans = spans.filter((s) => tuneless(s.start) && tuneless(s.end - 1) && rulesAt(s.start).tunelessRuns);
    if (quietSpans.length) {
      // With no tune at all the top line already moves (above); here only the bars that asked for more.
      if (tune.length) for (const s of quietSpans) moveTopLine(notes, [s], rulesAt(s.start).tunelessRuns ?? opts.level, s.key ?? toShape(input.key));
      notes = addChordRuns(notes, spans, opts.level, rulesAt, tuneless);
    }
  }

  // Not every note weighs the same: the tune leads, the thumb holds, inner notes stay under (M9).
  shapeDynamics(notes, beatsPerBar);
  // The vibe (M10): the mood's touch, then sections that build and breathe with the song.
  if (feel) applyTouch(notes, feel, beatsPerBar);
  if (sections) notes = applySections(notes, sections, beatsPerBar);
  const changes = plan?.flatMap((p, bar) => (bar === 0 || p !== plan[bar - 1] ? [{ bar, patternId: p.id }] : []));

  return {
    style: opts.style,
    level: opts.level,
    patternId: candidates[0].id,
    capo,
    meter: input.meter,
    bpm: input.bpm,
    bars,
    chordMarks,
    events: notes,
    warnings: warnings.list,
    ...(mood && feel ? { mood, feel } : {}),
    ...(sections ? { sections } : {}),
    ...(changes && changes.length > 1 ? { patternChanges: changes } : {}),
  };
}
