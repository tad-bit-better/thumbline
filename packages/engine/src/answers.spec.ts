import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { patternsFor } from './patterns/index.js';
import { isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, Arrangement, Level, MelodyNote, NoteEvent } from './types.js';

const BEAT = TICKS_PER_BEAT;
const BAR = 4 * BEAT;
const BEAT_SEC = 60 / 90;
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;
const note = (beat: number, beats: number, midi: number): MelodyNote => ({ startSec: beat * BEAT_SEC, durSec: beats * BEAT_SEC * 0.95, midi, confidence: 0.9 });
const sign = (x: number) => Math.sign(x);

// C major, 8 bars. Each bar: a phrase of three eighths (E D C) from beat 1, then the tune rests until the next bar.
const phrases: AnalysisResult = {
  ...progression('C | F | C | G | C | F | G | C'),
  melody: Array.from({ length: 8 }, (_, bar) => [note(bar * 4, 0.5, 76), note(bar * 4 + 0.5, 0.5, 74), note(bar * 4 + 1, 0.5, 72)]).flat(),
};
// Each bar: a note held two and a half beats, rising bar to bar.
const held: AnalysisResult = {
  ...progression('C | F | C | G | C | F | G | C'),
  melody: Array.from({ length: 8 }, (_, bar) => note(bar * 4, 2.5, [72, 74, 76, 74, 72, 74, 76, 72][bar])),
};
const sheet = (song: AnalysisResult, level: Level, fullness: number) =>
  arrange(song, { style: 'fingerstyle', level, capo: 0, fullness, patternId: patternsFor('fingerstyle', level, 4)[0].id });
const inRest = (a: Arrangement, bar: number) => a.events.filter((e) => e.fill && e.tick >= bar * BAR + 1.5 * BEAT && e.tick < (bar + 1) * BAR);

describe('answers to the tune (fullness 9–10)', () => {
  it('echoes the end of a phrase in the pause after it, in its rhythm and shape', () => {
    const a = sheet(phrases, 'moderate', 10);
    const echoes = [1, 2, 3, 4, 5, 6].map((bar) => inRest(a, bar)).filter((e) => e.length === 3);
    expect(echoes.length).toBeGreaterThan(3);
    for (const e of echoes) {
      // Eighths apart, like the phrase; falling, like the phrase (E D C).
      expect(e.map((n) => n.tick - e[0].tick)).toEqual([0, BEAT / 2, BEAT]);
      expect([sign(midiOf(e[1]) - midiOf(e[0])), sign(midiOf(e[2]) - midiOf(e[1]))]).toEqual([-1, -1]);
    }
  });

  it('plays a run there instead below 9, and nothing new at Basic', () => {
    expect([1, 2, 3, 4, 5, 6].some((bar) => inRest(sheet(phrases, 'moderate', 8), bar).length === 3)).toBe(false);
    expect(sheet(phrases, 'basic', 10).events.filter((e) => e.fill && e.tick % BAR >= 1.5 * BEAT).every((e) => e.tick % BAR >= 3 * BEAT)).toBe(true);
  });

  it('moves an inner voice against a held note, a beat at a time (Advanced)', () => {
    const a = sheet(held, 'advanced', 10);
    let moving = 0;
    for (let bar = 1; bar < 8; bar++) {
      const tune = a.events.find((e) => e.melody && e.tick === bar * BAR) as NoteEvent;
      const prev = a.events.find((e) => e.melody && e.tick === (bar - 1) * BAR) as NoteEvent;
      const inner = a.events.filter((e) => e.harmony && e.tick > tune.tick && e.tick < tune.tick + tune.dur && e.tick % BEAT === 0);
      if (inner.length < 1) continue;
      moving++;
      const voice = [...a.events.filter((e) => e.harmony && e.tick === tune.tick).sort((x, y) => midiOf(y) - midiOf(x)).slice(0, 1), ...inner];
      const tuneDir = sign(midiOf(tune) - midiOf(prev)) || 1;
      for (let i = 1; i < voice.length; i++) expect(sign(midiOf(voice[i]) - midiOf(voice[i - 1]))).not.toBe(tuneDir);
      for (const n of inner) expect(midiOf(n)).toBeLessThan(midiOf(tune));
    }
    expect(moving).toBeGreaterThan(3);
    // Not at 8, and not at Moderate.
    const quiet = (x: Arrangement) => x.events.filter((e) => e.harmony && e.tick % BAR !== 0 && e.tick % BEAT === 0 && e.tick % BAR < 2.5 * BEAT).length;
    expect(quiet(sheet(held, 'advanced', 8))).toBe(0);
    expect(quiet(sheet(held, 'moderate', 10))).toBe(0);
  });

  it('stays playable and never faster than 16ths', () => {
    for (const a of [sheet(phrases, 'advanced', 10), sheet(held, 'advanced', 10), sheet(phrases, 'moderate', 9)]) {
      expect(a.events.every((e) => e.tick % (BEAT / 4) === 0)).toBe(true);
      const byTick = new Map<number, NoteEvent[]>();
      for (const e of a.events) byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), e]);
      for (const [tick, notes] of byTick) {
        const mark = [...a.chordMarks].reverse().find((m) => m.tick <= tick);
        if (mark) expect(isPlayable(notes, mark.voicing)).toBe(true);
      }
    }
  });
});
