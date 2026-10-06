import { arrange } from './arrange.js';
import { chordTones } from './chords.js';
import { TICKS_PER_BEAT } from './constants.js';
import { isPlayable } from './runner.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, Arrangement, Level, MelodyNote, NoteEvent, Voicing } from './types.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const midiOf = (e: NoteEvent) => OPEN_MIDI[e.string] + e.fret;
const BEAT_SEC = 60 / 90;
const BAR = 4 * TICKS_PER_BEAT;
const note = (beat: number, beats: number, midi: number): MelodyNote => ({ startSec: beat * BEAT_SEC, durSec: beats * BEAT_SEC * 0.95, midi, confidence: 0.9 });

// C major, 4 bars: a held E on each downbeat, a quick passing note on the "and" of 2, a held G on 3.
const song: AnalysisResult = {
  ...progression('C | F | C | G'),
  melody: [0, 1, 2, 3].flatMap((bar) => [note(bar * 4, 1.5, 76), note(bar * 4 + 1.5, 0.4, 74), note(bar * 4 + 2, 2, 72)]),
};
const sheet = (level: Level) => arrange(song, { style: 'fingerstyle', level, capo: 0 });
const harmonyAt = (a: Arrangement, tick: number) => a.events.filter((e) => e.harmony && e.tick === tick);
const tuneAt = (a: Arrangement, tick: number) => a.events.find((e) => e.melody && e.tick === tick) as NoteEvent;

describe('harmony under the tune (M11)', () => {
  it('Moderate: a chord tone a third or sixth under the downbeat note, on a lower string, softer than the tune', () => {
    const a = sheet('moderate');
    for (const bar of [0, 1, 2, 3]) {
      const tune = tuneAt(a, bar * BAR);
      const [h] = harmonyAt(a, bar * BAR);
      expect(h).toBeDefined();
      expect(h.string).toBeLessThan(tune.string);
      expect([3, 4, 8, 9, 5]).toContain(midiOf(tune) - midiOf(h));
      expect(chordTones(song.chords[bar].chord!).has(midiOf(h) % 12)).toBe(true);
      expect(h.velocity).toBeLessThan(tune.velocity);
      // Bars 0 and 3 open with a roll (the phrase's first chord, the song's last): its chord tone is the harmony.
      if (bar === 1 || bar === 2) expect(['i', 'm']).toContain(h.finger);
    }
  });

  it('keeps every harmonised moment within the hand’s reach', () => {
    for (const level of ['moderate', 'advanced'] as const) {
      const a = sheet(level);
      for (const t of new Set(a.events.filter((e) => e.harmony).map((e) => e.tick))) {
        const voicing = a.chordMarks.filter((m) => m.tick <= t).at(-1)?.voicing as Voicing;
        expect(isPlayable(a.events.filter((e) => e.tick === t), voicing)).toBe(true);
      }
    }
  });

  it('leaves a quick passing note alone', () => {
    expect(harmonyAt(sheet('moderate'), 1.5 * TICKS_PER_BEAT)).toEqual([]);
  });

  it('harmonises a note held for a beat or more mid-bar', () => {
    expect(harmonyAt(sheet('moderate'), 2 * TICKS_PER_BEAT).length).toBe(1);
  });

  it('Advanced: puts the chord under the downbeat note (two voices)', () => {
    const a = sheet('advanced');
    const twos = [0, 1, 2, 3].filter((bar) => harmonyAt(a, bar * BAR).length === 2);
    expect(twos.length).toBeGreaterThanOrEqual(3);
  });

  it('Basic stays plain', () => {
    expect(sheet('basic').events.some((e) => e.harmony)).toBe(false);
  });

  it('never doubles a string at one moment', () => {
    for (const level of ['moderate', 'advanced'] as const) {
      const a = sheet(level);
      const seen = new Set<string>();
      for (const e of a.events) {
        const k = `${e.tick}:${e.string}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });
});
