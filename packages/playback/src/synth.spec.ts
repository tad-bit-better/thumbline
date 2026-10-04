import type { NoteEvent } from '@thumbline/engine';
import { STRUM_STEP_MS, golpeBurst, midiOf, noteGain, nylonPluck, roomImpulse, strumOffsets } from './synth.js';

const SR = 44100;

/** Fundamental via autocorrelation with parabolic interpolation. */
function pitchHz(x: Float32Array, from: number, len: number, minHz = 60, maxHz = 1400): number {
  const w = x.subarray(from, from + len);
  const minLag = Math.floor(SR / maxHz);
  const maxLag = Math.ceil(SR / minHz);
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < w.length; i++) s += w[i] * w[i + lag];
    return s;
  };
  const values = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) values[lag] = ac(lag);
  const zero = ac(0);
  // First peak that reaches 85% of the best one avoids octave errors.
  let best = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) if (values[lag] > values[best]) best = lag;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (values[lag] > values[lag - 1] && values[lag] >= values[lag + 1] && values[lag] > 0.85 * values[best] && values[lag] > 0.2 * zero) {
      best = lag;
      break;
    }
  }
  const [a, b, c] = [values[best - 1], values[best], values[best + 1]];
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return SR / (best + shift);
}

const cents = (hz: number, midi: number) => 1200 * Math.log2(hz / (440 * 2 ** ((midi - 69) / 12)));
const rms = (x: Float32Array, from: number, len: number) => {
  let s = 0;
  for (let i = from; i < from + len; i++) s += x[i] * x[i];
  return Math.sqrt(s / len);
};

describe('midiOf', () => {
  it('adds the open string, capo and fret (engine-spec)', () => {
    expect(midiOf(0, 0, 0)).toBe(40);
    expect(midiOf(5, 3, 2)).toBe(69);
  });
});

describe('nylonPluck', () => {
  it.each([40, 45, 52, 57, 64, 69, 76, 81])('is in tune within 5 cents at MIDI %i', (midi) => {
    const x = nylonPluck(midi, SR, { seed: 7 });
    expect(Math.abs(cents(pitchHz(x, 4000, 8192), midi))).toBeLessThan(5);
  });

  it('decays, and low strings ring longer than high ones', () => {
    const low = nylonPluck(40, SR, { seed: 1 });
    const high = nylonPluck(76, SR, { seed: 1 });
    const second = Math.floor(SR * 1.2);
    const ratio = (x: Float32Array) => rms(x, second, 4410) / rms(x, 2000, 4410);
    expect(ratio(low)).toBeLessThan(0.8);
    expect(ratio(high)).toBeLessThan(ratio(low));
  });

  it('is normalised, finite and fades to silence', () => {
    const x = nylonPluck(52, SR, { seed: 3 });
    let peak = 0;
    for (const v of x) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
    }
    expect(peak).toBeCloseTo(0.9, 2);
    expect(Math.abs(x[x.length - 1])).toBeLessThan(1e-3);
  });

  it('is deterministic for a seed', () => {
    expect(nylonPluck(60, SR, { seed: 5 })).toEqual(nylonPluck(60, SR, { seed: 5 }));
    expect(nylonPluck(60, SR, { seed: 5 })).not.toEqual(nylonPluck(60, SR, { seed: 6 }));
  });
});

const energyDb = (x: Float32Array, fromSec: number, toSec: number, sr = SR) => {
  let s = 0;
  for (let i = Math.floor(fromSec * sr); i < Math.floor(toSec * sr); i++) s += x[i] * x[i];
  return 10 * Math.log10(s / ((toSec - fromSec) * sr) + 1e-12);
};

describe('sustain', () => {
  it('lets treble notes ring past the next beat of a slow song', () => {
    // E5 on the top string: a second later it must still be clearly there (it was ~40 dB down).
    const x = nylonPluck(76, SR);
    expect(energyDb(x, 1, 1.2) - energyDb(x, 0, 0.2)).toBeGreaterThan(-28);
  });

  it('keeps bass notes ringing longer than treble', () => {
    const drop = (midi: number) => {
      const x = nylonPluck(midi, SR);
      return energyDb(x, 1.5, 1.7) - energyDb(x, 0, 0.2);
    };
    expect(drop(40)).toBeGreaterThan(drop(76));
  });
});

describe('roomImpulse', () => {
  const [l, r] = roomImpulse(SR);

  it('decays to near silence', () => {
    expect(energyDb(l, 1.6, 1.8) - energyDb(l, 0, 0.2)).toBeLessThan(-30);
  });

  it('differs between channels, for width', () => {
    let lr = 0;
    let ll = 0;
    let rr = 0;
    for (let i = 0; i < l.length; i++) {
      lr += l[i] * r[i];
      ll += l[i] * l[i];
      rr += r[i] * r[i];
    }
    expect(Math.abs(lr / Math.sqrt(ll * rr))).toBeLessThan(0.3);
  });
});

describe('golpeBurst', () => {
  it('is a short, percussive tap', () => {
    const x = golpeBurst(SR, 2);
    const total = rms(x, 0, x.length);
    expect(x.length).toBeLessThan(SR * 0.25);
    expect(rms(x, 0, Math.floor(SR * 0.04))).toBeGreaterThan(total);
    expect(Math.max(...x.map(Math.abs))).toBeCloseTo(0.8, 2);
  });
});

describe('strumOffsets', () => {
  const ev = (string: number, tech: NoteEvent['tech'], extra: Partial<NoteEvent> = {}): NoteEvent => ({
    tick: 0,
    dur: 240,
    string,
    fret: 0,
    finger: 'i',
    velocity: 0.8,
    tech,
    ...extra,
  });

  it('strums down from the low string', () => {
    const events = [0, 1, 2, 3, 4, 5].map((s) => ev(s, 'rasgueo-down'));
    const o = strumOffsets(events);
    expect([0, 1, 2, 3, 4, 5].map((i) => o.get(i))).toEqual([0, 1, 2, 3, 4, 5].map((k) => (k * STRUM_STEP_MS) / 1000));
  });

  it('strums up from the high string', () => {
    const events = [0, 1, 2, 3, 4, 5].map((s) => ev(s, 'rasgueo-up'));
    const o = strumOffsets(events);
    expect(o.get(5)).toBe(0);
    expect(o.get(0)).toBeCloseTo((5 * STRUM_STEP_MS) / 1000);
  });

  it('uses an explicit stagger from the engine', () => {
    const o = strumOffsets([ev(0, 'rasgueo-down', { strumOffsetMs: 30 })]);
    expect(o.get(0)).toBeCloseTo(0.03);
  });

  it('leaves other notes alone', () => {
    expect(strumOffsets([ev(0, undefined), ev(5, 'pinch')]).size).toBe(0);
  });
});

describe('noteGain', () => {
  const base: NoteEvent = { tick: 0, dur: 240, string: 4, fret: 0, finger: 'i', velocity: 0.8 };
  it('weights accents up and legato notes down, never above 1', () => {
    const plain = noteGain(base);
    expect(noteGain({ ...base, accent: true })).toBeGreaterThan(plain);
    expect(noteGain({ ...base, tech: 'hammer' })).toBeLessThan(plain);
    expect(noteGain({ ...base, string: 0 })).toBeGreaterThan(plain);
    expect(noteGain({ ...base, velocity: 1, accent: true, string: 0 })).toBeLessThanOrEqual(1);
  });
});
