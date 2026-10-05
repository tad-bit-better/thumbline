import { TICKS_PER_BEAT } from './constants.js';
import type { ChordSpan } from './runner.js';
import type { BeatsPerBar, Mood, NoteEvent } from './types.js';

/** Bars between phrase-opening rolls: calm songs roll every phrase, driving ones every other. */
const PHRASE_BARS_CALM = 4;
const PHRASE_BARS_DRIVING = 8;
const DRIVING = 0.5;
/** A roll is a touch softer than a plucked pinch, so the strings blend. */
const ROLL_VELOCITY = 0.75;

/**
 * engine-spec §4 rolls (M11): a guitarist opens a phrase, and ends the song,
 * with a slow strum that lets the chord ring. The chord starting on the first
 * bar of each phrase (every 4 bars; every 8 when the song drives, energy 0.5+)
 * and the song's last chord open with a thumb brush (`brush-down`) across
 * every string of the shape, replacing the plucks on that tick. A string with
 * a hammer-on or pull-off in the chord's first beat keeps its own note (the
 * slur needs it). The last chord's roll rings to the end. Flamenco keeps its
 * own strums (the caller skips it).
 */
export function addRolls(events: NoteEvent[], spans: readonly ChordSpan[], beatsPerBar: BeatsPerBar, mood?: Mood): NoteEvent[] {
  const bar = beatsPerBar * TICKS_PER_BEAT;
  const every = (mood && mood.energy >= DRIVING ? PHRASE_BARS_DRIVING : PHRASE_BARS_CALM) * bar;
  const last = spans.at(-1);
  const rolled = new Set<ChordSpan>(spans.filter((s) => s.start % every === 0 || s === last));
  let out = events;
  for (const span of rolled) {
    const slurred = new Set(
      out.filter((e) => (e.tech === 'hammer' || e.tech === 'pull') && e.tick > span.start && e.tick <= span.start + TICKS_PER_BEAT).map((e) => e.string),
    );
    const plucks = out.filter((e) => e.tick === span.start && e.fret >= 0 && !slurred.has(e.string));
    const velocity = plucks.length ? Math.max(...plucks.map((e) => e.velocity)) * ROLL_VELOCITY : 0.6;
    out = out.filter((e) => !plucks.includes(e));
    span.voicing.frets.forEach((fret, string) => {
      if (fret < 0 || slurred.has(string)) return;
      out.push({
        tick: span.start,
        dur: span === last ? span.end - span.start : Math.min(span.end - span.start, 2 * TICKS_PER_BEAT),
        string,
        fret,
        finger: 'p',
        velocity: Math.round(velocity * 100) / 100,
        tech: 'brush-down',
      });
    });
  }
  return out.sort((a, b) => a.tick - b.tick || a.string - b.string);
}
