import { arrange } from './arrange.js';
import { TICKS_PER_BEAT } from './constants.js';
import { DEFAULT_FULLNESS, fullnessRules } from './fullness.js';
import { isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, Arrangement, Level, MelodyNote } from './types.js';

const BEAT = TICKS_PER_BEAT;
const BEAT_SEC = 60 / 90;
const note = (beat: number, beats: number, midi: number): MelodyNote => ({ startSec: beat * BEAT_SEC, durSec: beats * BEAT_SEC * 0.95, midi, confidence: 0.9 });

// C major. Each bar: a held note, a quick eighth-note pair, a half-beat rest, then a long rest before the next bar.
const song: AnalysisResult = {
  ...progression('C | Am | F | G | C | Am | F | C'),
  melody: [72, 76, 77, 74, 72, 76, 77, 72].flatMap((midi, bar) => [note(bar * 4, 1, midi), note(bar * 4 + 1, 0.5, midi - 1), note(bar * 4 + 1.5, 0.4, midi - 3)]),
};
const sheet = (level: Level, fullness?: number) => arrange(song, { style: 'fingerstyle', level, capo: 0, fullness });
const count = (a: Arrangement, kind: 'fill' | 'harmony' | 'walk') => a.events.filter((e) => e[kind]).length;
const onsets = (a: Arrangement) => new Set(a.events.map((e) => e.tick)).size;

describe('fullness (how much the guitar fills in)', () => {
  it('5 is the default and plays as before', () => {
    expect(DEFAULT_FULLNESS).toBe(5);
    for (const level of ['basic', 'moderate', 'advanced'] as const) expect(sheet(level, 5).events).toEqual(sheet(level).events);
  });

  it('rejects values outside 1–10', () => {
    expect(() => sheet('moderate', 0)).toThrow(/1 to 10/);
    expect(() => sheet('moderate', 11)).toThrow(/1 to 10/);
    expect(() => sheet('moderate', 5.5)).toThrow(/1 to 10/);
  });

  it('fills more of the silences and harmonises more as it rises', () => {
    for (const level of ['moderate', 'advanced'] as const) {
      const [low, mid, high] = [1, 5, 10].map((f) => sheet(level, f));
      expect(count(low, 'fill') + count(low, 'harmony') + count(low, 'walk')).toBe(0);
      expect(count(high, 'fill')).toBeGreaterThan(count(mid, 'fill'));
      expect(count(high, 'harmony')).toBeGreaterThan(count(mid, 'harmony'));
      expect(low.events.length).toBeLessThan(mid.events.length);
    }
  });

  it('fills silences rather than speeding up: no faster rhythm, never over a sounding tune note', () => {
    const high = sheet('advanced', 10);
    const mid = sheet('advanced', 5);
    expect(high.events.every((e) => e.tick % (BEAT / 4) === 0)).toBe(true);
    // Moments a beat can hold stay what the level allows (16ths), so it never sounds rushed.
    const perBeat = (a: Arrangement) => Math.max(...Array.from({ length: a.bars * 4 }, (_, b) => new Set(a.events.filter((e) => Math.floor(e.tick / BEAT) === b).map((e) => e.tick)).size));
    expect(perBeat(high)).toBeLessThanOrEqual(4);
    expect(onsets(high)).toBeGreaterThanOrEqual(onsets(mid));
    const tune = high.events.filter((e) => e.melody);
    for (const f of high.events.filter((e) => e.fill)) expect(tune.some((t) => t.tick < f.tick && f.tick < t.tick + t.dur)).toBe(false);
  });

  it('keeps Basic plain until 8, then lets it fill in too', () => {
    expect(count(sheet('basic', 7), 'fill') + count(sheet('basic', 7), 'harmony')).toBe(0);
    expect(count(sheet('basic', 8), 'fill') + count(sheet('basic', 8), 'harmony')).toBeGreaterThan(0);
  });

  it('catches more of the tune at the top: Basic hears the eighth notes', () => {
    const tuneNotes = (a: Arrangement) => a.events.filter((e) => e.melody).length;
    expect(tuneNotes(sheet('basic', 8))).toBeGreaterThan(tuneNotes(sheet('basic', 5)));
  });

  it('stays playable at every setting', () => {
    for (const f of [1, 3, 5, 7, 10]) {
      const a = sheet('advanced', f);
      const byTick = new Map<number, typeof a.events>();
      for (const e of a.events) byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), e]);
      for (const [tick, notes] of byTick) {
        const mark = [...a.chordMarks].reverse().find((m) => m.tick <= tick);
        if (mark) expect(isPlayable(notes, mark.voicing)).toBe(true);
      }
    }
  });

  it('describes each setting', () => {
    expect(fullnessRules(1, 'advanced').fillRest).toBeNull();
    expect(fullnessRules(5, 'advanced').fillRest).toBe(BEAT);
    expect(fullnessRules(10, 'advanced').fillRest).toBe(BEAT / 2);
  });
});
