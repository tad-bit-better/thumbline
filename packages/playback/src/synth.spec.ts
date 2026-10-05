import type { NoteEvent } from '@thumbline/engine';
import { STRUM_STEP_MS, feelOf, humanize, apagadoChunk, golpeBurst, harmonicTone, midiOf, noteGain, nylonPluck, roomImpulse, slapBurst, soundOf, strumOffsets } from './synth.js';

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

describe('feelOf', () => {
  it('strums a sad song slower, darker and roomier than a happy one', () => {
    const sad = feelOf({ energy: 0.25, valence: 0.25 });
    const happy = feelOf({ energy: 0.75, valence: 0.75 });
    expect(sad.strumMs).toBeGreaterThan(happy.strumMs);
    expect(sad.shelfDb).toBeLessThan(happy.shelfDb);
    expect(sad.reverb).toBeGreaterThan(happy.reverb);
    expect([sad.crisp, happy.crisp]).toEqual([false, true]);
  });

  it('moves smoothly with the sliders', () => {
    expect(feelOf({ energy: 0.4, valence: 0.5 }).strumMs).toBeLessThan(feelOf({ energy: 0.1, valence: 0.5 }).strumMs);
  });

  it('spaces the strings of a strum by the mood’s step', () => {
    const strum: NoteEvent[] = [0, 1, 2].map((string) => ({ tick: 0, dur: 240, string, fret: 0, finger: 'i', velocity: 0.8, tech: 'rasgueo-down' }));
    expect([...strumOffsets(strum, 18).values()]).toEqual([0, 0.018, 0.036]);
  });
});

describe('melody', () => {
  it('lifts a note of the tune above the pattern', () => {
    const plain: NoteEvent = { tick: 0, dur: 480, string: 5, fret: 3, finger: 'a', velocity: 0.8 };
    expect(noteGain({ ...plain, melody: true })).toBeGreaterThan(noteGain(plain) * 1.2);
  });
});

/** Spectral centroid (Hz, up to 8 kHz) over the first second: how bright a note sounds. */
function centroidHz(x: Float32Array): number {
  const N = 2048;
  const bins = Math.floor((8000 / SR) * N);
  let num = 0;
  let den = 0;
  for (let start = 0; start + N < Math.min(SR, x.length); start += N * 2) {
    for (let k = 1; k < bins; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n += 2) {
        const v = x[start + n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N));
        re += v * Math.cos((2 * Math.PI * k * n) / N);
        im -= v * Math.sin((2 * Math.PI * k * n) / N);
      }
      const mag = Math.hypot(re, im);
      num += (mag * k * SR) / N;
      den += mag;
    }
  }
  return num / den;
}

describe('humanize', () => {
  const ev = (tick: number, string = 3): NoteEvent => ({ tick, dur: 240, string, fret: 0, finger: 'i', velocity: 0.8 });
  const events = Array.from({ length: 256 }, (_, i) => ev(i * 120));

  it('is repeatable for a seed', () => {
    expect(humanize(events, 4, 3)).toEqual(humanize(events, 4, 3));
  });

  it('sits a person’s distance off the grid: typically 5–15 ms, never more than 20', () => {
    const off = humanize(events, 4).map((h) => Math.abs(h.offsetSec * 1000));
    const sorted = [...off].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(4);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(15);
    expect(Math.max(...off)).toBeLessThanOrEqual(20);
  });

  it('moves notes struck together as one', () => {
    const [a, b] = humanize([ev(0, 0), ev(0, 5)], 4);
    expect(a.offsetSec).toBe(b.offsetSec);
  });

  it('varies the touch, a little heavier on the beat', () => {
    const h = humanize(events, 4);
    const db = h.map((x) => 20 * Math.log10(x.gain));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const spread = Math.sqrt(mean(db.map((d) => (d - mean(db)) ** 2)));
    expect(spread).toBeGreaterThan(1);
    const onBeat = h.filter((_, i) => events[i].tick % 480 === 0).map((x) => x.gain);
    const offSixteenth = h.filter((_, i) => events[i].tick % 240 !== 0).map((x) => x.gain);
    expect(mean(onBeat)).toBeGreaterThan(mean(offSixteenth));
  });
});

describe('tone', () => {
  // Fingerstyle recordings measure about 1.1–1.5 kHz; the M6 pluck was 1.4–2.2 kHz, brightest on the low E.
  it.each([45, 52, 64])('is warm, not brittle, at MIDI %i', (midi) => {
    expect(centroidHz(nylonPluck(midi, SR))).toBeLessThan(1500);
  });

  it('keeps a high note sweet rather than shrill (its fundamental alone is 659 Hz)', () => {
    expect(centroidHz(nylonPluck(76, SR))).toBeLessThan(1900);
  });
});

describe('palm-muted pluck', () => {
  it('stays in tune but dies within half a second', () => {
    const muted = nylonPluck(45, SR, { seed: 4, muted: true });
    const open = nylonPluck(45, SR, { seed: 4 });
    expect(Math.abs(cents(pitchHz(muted, 400, 4096), 45))).toBeLessThan(10);
    const at = Math.floor(SR * 0.4);
    expect(rms(muted, at, 2205) / rms(muted, 0, 2205)).toBeLessThan(0.05);
    // An open string keeps ringing (its bright overtones fade first since M9, so about −12 dB here).
    expect(rms(open, at, 2205) / rms(open, 0, 2205)).toBeGreaterThan(0.2);
    expect(muted.length).toBeLessThan(SR);
  });
});

describe('harmonicTone', () => {
  it('is in tune and rings for seconds', () => {
    const x = harmonicTone(76, SR);
    expect(Math.abs(cents(pitchHz(x, 4000, 8192, 200, 1400), 76))).toBeLessThan(5);
    expect(rms(x, Math.floor(SR * 1.5), 4410)).toBeGreaterThan(0.02);
  });
});

describe('slap and apagado', () => {
  it('are short percussive bursts, the apagado quieter and shorter', () => {
    const slap = slapBurst(SR);
    const chunk = apagadoChunk(SR);
    expect(slap.length).toBeLessThan(SR * 0.2);
    expect(chunk.length).toBeLessThan(slap.length);
    expect(rms(slap, 0, Math.floor(SR * 0.03))).toBeGreaterThan(rms(slap, 0, slap.length));
    expect(Math.max(...chunk.map(Math.abs))).toBeLessThan(Math.max(...slap.map(Math.abs)));
  });
});

describe('soundOf', () => {
  const note = (extra: Partial<NoteEvent>): NoteEvent => ({ tick: 0, dur: 240, string: 5, fret: 0, finger: 'i', velocity: 0.8, ...extra });

  it('maps techniques to sounds', () => {
    expect(soundOf(note({ fret: 3 }), 2)).toEqual({ kind: 'pluck', midi: 69 });
    expect(soundOf(note({ string: 0, fret: 3, tech: 'palm-mute' }), 0)).toEqual({ kind: 'muted', midi: 43 });
    expect(soundOf(note({ fret: 2, tech: 'hammer' }), 0)).toEqual({ kind: 'legato', midi: 66 });
    expect(soundOf(note({ fret: -1, tech: 'golpe' }), 0)).toEqual({ kind: 'golpe' });
    expect(soundOf(note({ fret: -1, tech: 'slap' }), 0)).toEqual({ kind: 'slap' });
    expect(soundOf(note({ fret: -1, tech: 'apagado' }), 0)).toEqual({ kind: 'apagado' });
  });

  it('sounds a harmonic an octave (fret 12) or an octave and a fifth (fret 7) above the open string', () => {
    expect(soundOf(note({ fret: 12, tech: 'harmonic' }), 0)).toEqual({ kind: 'harmonic', midi: 76 });
    expect(soundOf(note({ fret: 7, tech: 'harmonic' }), 0)).toEqual({ kind: 'harmonic', midi: 83 });
    expect(soundOf(note({ fret: 12, tech: 'harmonic' }), 3)).toEqual({ kind: 'harmonic', midi: 79 });
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
