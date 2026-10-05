import { shapeDynamics } from './dynamics.js';
import type { NoteEvent } from './types.js';

const n = (tick: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({ tick, dur: 240, string: 3, fret: 0, finger: 'i', velocity: 0.8, ...extra });

describe('shapeDynamics', () => {
  it('puts the tune over the thumb, and the thumb over the inner fingers', () => {
    const e = [n(0, { finger: 'p', string: 0 }), n(0, { string: 3 }), n(0, { string: 5, fret: 3, melody: true, velocity: 0.9 })];
    shapeDynamics(e, 4);
    const [bass, inner, tune] = e.map((x) => x.velocity);
    expect(tune).toBeGreaterThan(bass);
    expect(bass).toBeGreaterThan(inner);
  });

  it('leans on the downbeat and lightens the off-beats', () => {
    const e = [n(0), n(480), n(240), n(120)];
    shapeDynamics(e, 4);
    const [down, beat, offEighth, offSixteenth] = e.map((x) => x.velocity);
    expect(down).toBeGreaterThan(beat);
    expect(beat).toBeGreaterThan(offEighth);
    expect(offEighth).toBeGreaterThan(offSixteenth);
  });

  it('shapes a phrase of the tune: it swells to its high point and eases off at the end', () => {
    // A rising and falling line on the e string: E F# G A G F# E
    const frets = [0, 2, 3, 5, 3, 2, 0];
    const e = frets.map((fret, i) => n(i * 240, { string: 5, fret, melody: true, velocity: 0.9 }));
    shapeDynamics(e, 4);
    const v = e.map((x) => x.velocity);
    const peak = v.indexOf(Math.max(...v));
    expect(peak).toBe(3);
    expect(v[0]).toBeLessThan(v[3]);
    expect(v[6]).toBeLessThan(v[5]);
  });

  it('starts a new phrase after a rest of a beat', () => {
    const e = [n(0, { melody: true, string: 5, fret: 5, velocity: 0.9 }), n(240, { melody: true, string: 5, fret: 0, velocity: 0.9 }), n(1440, { melody: true, string: 5, fret: 0, velocity: 0.9 })];
    shapeDynamics(e, 4);
    // The third note opens a fresh phrase of one note: full weight, not a fading tail.
    expect(e[2].velocity).toBeGreaterThan(e[1].velocity);
  });

  it('leaves golpes, slaps and apagados alone and keeps every velocity in 0.2..1', () => {
    const e = [n(0, { fret: -1, tech: 'golpe', velocity: 0.8 }), n(120, { velocity: 0.1 }), n(0, { melody: true, string: 5, fret: 12, velocity: 1 })];
    shapeDynamics(e, 4);
    expect(e[0].velocity).toBe(0.8);
    for (const x of e) {
      expect(x.velocity).toBeGreaterThanOrEqual(0.2);
      expect(x.velocity).toBeLessThanOrEqual(1);
    }
  });
});
