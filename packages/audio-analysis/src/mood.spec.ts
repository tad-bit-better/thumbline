import { beatEnergyOf, moodOf } from './mood.js';
import type { ChordSegment } from './types.js';

const seg = (quality: 'maj' | 'm' | '7'): ChordSegment => ({ bar: 0, beat: 0, chord: { pc: 0, quality }, confidence: 1, alternatives: [] });
const ballad = { bpm: 70, onsetRate: 2.5, danceability: 0.9, brightnessHz: 1500, mode: 'minor' as const, chords: [seg('m'), seg('m'), seg('maj')] };
const pop = { bpm: 128, onsetRate: 4.5, danceability: 1.8, brightnessHz: 2800, mode: 'major' as const, chords: [seg('maj'), seg('maj'), seg('7'), seg('m')] };

describe('moodOf', () => {
  it('reads a slow minor ballad as calm and dark', () => {
    const m = moodOf(ballad);
    expect(m.energy).toBeLessThan(0.35);
    expect(m.valence).toBeLessThan(0.3);
  });

  it('reads a fast major pop song as driving and bright', () => {
    const m = moodOf(pop);
    expect(m.energy).toBeGreaterThan(0.7);
    expect(m.valence).toBeGreaterThan(0.75);
  });

  it('stays in 0..1 at the extremes', () => {
    for (const m of [moodOf({ ...pop, bpm: 300, onsetRate: 20, danceability: 9, brightnessHz: 9000 }), moodOf({ ...ballad, bpm: 10, onsetRate: 0, danceability: 0, brightnessHz: 0, chords: [] })]) {
      for (const v of [m.energy, m.valence]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('beatEnergyOf', () => {
  it('scales loudness so the loud end of the song is 1', () => {
    const e = beatEnergyOf([0.1, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.8]);
    expect(e[0]).toBeCloseTo(0.25);
    expect(e.at(-1)).toBe(1);
  });
});
