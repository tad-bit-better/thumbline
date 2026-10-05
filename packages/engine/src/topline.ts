import { chordTones } from './chords.js';
import type { ChordSpan } from './runner.js';
import type { AnalysisResult, Level, NoteEvent } from './types.js';

/** engine-spec: MIDI of each open string, string 0 = low E. */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;
/** The fretting hand covers four frets: lowest to highest fretted note at most 3 apart. */
const MAX_REACH = 3;
const MAX_FINGERS = 4;

type Option = { fret: number; midi: number };
type Key = AnalysisResult['key'];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const scaleOf = (key: Key) => new Set((key.mode === 'minor' ? MINOR : MAJOR).map((i) => (key.pc + i) % 12));

/** The top sounded string of a shape (the one `t1` resolves to). */
function topStringOf(span: ChordSpan): number | null {
  const { frets, rootString } = span.voicing;
  for (let s = 5; s > rootString; s--) if (frets[s] >= 0) return s;
  return null;
}

/**
 * Frets on the top string the hand can reach without letting go of the
 * shape, that sound a chord tone: the shape's own fret, the open string
 * (unless a barre covers it), or a fret within reach with a finger to spare.
 */
export function topOptions(span: ChordSpan, pcs: ReadonlySet<number> = chordTones(span.played)): Option[] {
  const top = topStringOf(span);
  if (top === null) return [];
  const { frets, barre } = span.voicing;
  const tones = pcs;
  const others = frets.filter((f, s) => s !== top && f > 0);
  const barreFret = barre && others.length ? Math.min(...others) : null;
  // A barre is one finger for every string at its fret.
  const fingers = others.filter((f) => f !== barreFret).length + (barreFret === null ? 0 : 1);
  const own = frets[top];
  const out: Option[] = [];
  for (let fret = 0; fret <= 12; fret++) {
    const midi = OPEN_MIDI[top] + fret;
    if (!tones.has(midi % 12)) continue;
    if (fret !== own) {
      if (fret === 0 && barreFret !== null) continue;
      if (fret > 0) {
        const all = [...others, fret];
        if (Math.max(...all) - Math.min(...all) > MAX_REACH) continue;
        if (fret !== barreFret && fingers + 1 > MAX_FINGERS) continue;
      }
    }
    out.push({ fret, midi });
  }
  return out;
}

const nearest = (options: Option[], midi: number, fallback: Option) =>
  options.reduce((best, o) => (Math.abs(o.midi - midi) < Math.abs(best.midi - midi) ? o : best), fallback);

/**
 * The note the line moves to from `base`: the next chord tone up, else a
 * key note two or three semitones up (G over Am, A over G: a seventh or an
 * added ninth), else the same downwards. Within reach of the shape.
 *
 * MUSIC-REVIEW: a 2-semitone colour can be a fourth over a minor chord (A over
 * Em), which rings against the third; and some reaches are a full 4-fret
 * stretch (G shape with the pinky on 5). Check both sound and feel right.
 */
function neighbourOf(base: Option, chord: Option[], inKey: Option[]): Option | undefined {
  const step = (o: Option) => Math.abs(o.midi - base.midi);
  const up = (list: Option[]) => list.filter((o) => o.midi > base.midi).sort((a, b) => a.midi - b.midi);
  const down = (list: Option[]) => list.filter((o) => o.midi < base.midi).sort((a, b) => b.midi - a.midi);
  const colour = (list: Option[]) => list.filter((o) => step(o) === 2 || step(o) === 3);
  return up(chord).find((o) => step(o) <= 5) ?? colour(up(inKey))[0] ?? down(chord).find((o) => step(o) <= 5) ?? colour(down(inKey))[0];
}

/**
 * A top line that moves (M6b C1): within each chord, notes on the top
 * string alternate between a chord tone (the one closest to where the line
 * was) and a neighbour (see neighbourOf), so the sheet carries a tune
 * instead of repeating one note. `key` is in shape space (capo removed); a
 * span's own key, when it has one, wins (songs that change key).
 * Basic sheets keep the shape's own note.
 * Notes in a hammer-on or pull-off are left alone.
 */
export function moveTopLine(events: NoteEvent[], spans: readonly ChordSpan[], level: Level, key: Key): void {
  if (level === 'basic') return;
  const scale = scaleOf(key);
  let last: number | null = null;
  for (const span of spans) {
    const top = topStringOf(span);
    if (top === null) continue;
    // Plucked top-string notes only: not the thumb, not a strum, not a golpe.
    const notes = events.filter(
      (e) => e.string === top && e.finger !== 'p' && e.fret >= 0 && !e.tech?.startsWith('rasgueo') && !e.tech?.startsWith('brush') && e.tech !== 'harmonic' && e.tick >= span.start && e.tick < span.end,
    );
    const legato = events.some((e) => e.string === top && e.tick >= span.start && e.tick < span.end && (e.tech === 'hammer' || e.tech === 'pull'));
    const options = topOptions(span);
    const own = options.find((o) => o.fret === span.voicing.frets[top]);
    if (!notes.length || !own) continue;
    if (legato) {
      last = own.midi;
      continue;
    }
    const base: Option = last === null ? own : nearest(options, last, own);
    const neighbour = neighbourOf(base, options, topOptions(span, span.key ? scaleOf(span.key) : scale)) ?? base;
    notes.forEach((n, i) => {
      n.fret = i % 2 === 0 ? base.fret : neighbour.fret;
    });
    last = (notes.length % 2 === 1 ? base : neighbour).midi;
  }
}
