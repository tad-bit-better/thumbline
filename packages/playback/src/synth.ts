import type { Mood, NoteEvent } from '@thumbline/engine';

/** engine-spec: MIDI of each open string, string 0 = low E. */
const OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;

/** Gap between strings in a rasgueado stroke. */
export const STRUM_STEP_MS = 12;

export const midiOf = (string: number, fret: number, capo: number) => OPEN_MIDI[string] + capo + fret;

const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Small seeded PRNG (mulberry32) so renders are repeatable in tests. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalise(x: Float32Array, peak: number) {
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / max;
  return x;
}

/**
 * Ring time to −60 dB: about 4.5 s on the low E down to 2.2 s high up the
 * neck. Long enough for an arpeggio to build into a chord (M6b; it was
 * 3.2 → 1 s, and the treble died before the next note).
 */
function t60(hz: number) {
  return 4.5 + (2.2 - 4.5) * rangePos(hz);
}

/** Loop gain ceiling: below 1, so a string always dies away. */
const MAX_LOOP_GAIN = 0.99995;

export type PluckOptions = {
  seconds?: number;
  seed?: number;
  /** Palm-muted: the heel of the hand damps the string, so it dies in a fraction of a second and sounds darker. */
  muted?: boolean;
};

/** Ring time of a palm-muted note. */
const MUTED_T60 = 0.22;

/** Where in the string's range a note sits: 0 at the low E, 1 high up the neck. */
const rangePos = (hz: number) => Math.min(1, Math.max(0, Math.log2(hz / 82) / Math.log2(1300 / 82)));

/** The finger's excitation is low-passed at this multiple of the note's pitch: a soft pulse, not a bright click. */
const EXCITE_CUTOFF_X = 8;
const MUTED_EXCITE_CUTOFF_X = 4;
/** Loop low-pass (one-pole coefficient) from the low E to the top of the neck: highs fade in time, not per round trip. */
const LOOP_DAMP_LOW = 0.6;
const LOOP_DAMP_HIGH = 0.1;

/**
 * Nylon-string pluck by Karplus-Strong with a first-order allpass for
 * fractional delay, so high notes stay in tune (Jaffe & Smith).
 * M9 tone (measured against fingerstyle recordings: they sit near 1.1–1.5 kHz
 * spectral centroid, the old pluck near 2 kHz even on the low E): the
 * excitation is low-passed relative to the pitch, and a one-pole low-pass in the loop (stronger on low strings,
 * whose upper harmonics otherwise linger) darkens the ring; its delay and
 * gain at the fundamental are compensated, so tuning and t60 hold.
 */
export function nylonPluck(midi: number, sampleRate: number, { seconds, seed = midi, muted = false }: PluckOptions = {}): Float32Array {
  seconds ??= muted ? 0.6 : 4;
  const hz = hzOf(midi);
  const w0 = (2 * Math.PI * hz) / sampleRate;
  const damp = LOOP_DAMP_LOW + (LOOP_DAMP_HIGH - LOOP_DAMP_LOW) * rangePos(hz);
  // The loop low-pass's phase delay and gain at the fundamental.
  const dampDelay = Math.atan2(damp * Math.sin(w0), 1 - damp * Math.cos(w0)) / w0;
  const dampGain = (1 - damp) / Math.sqrt(1 - 2 * damp * Math.cos(w0) + damp * damp);
  const period = sampleRate / hz;
  // Loop delay = N (buffer) + 0.5 (averaging filter) + the low-pass's delay + d (allpass), with d in (0.1, 1.1].
  const n = Math.floor(period - 0.6 - dampDelay);
  const d = period - 0.5 - dampDelay - n;
  const c = (1 - d) / (1 + d);
  // Per-period loss for the target t60, less what the averaging filter and the low-pass already take
  // from the fundamental; capped below 1 to stay stable.
  const ring = muted ? MUTED_T60 : t60(hz);
  const loss = Math.min(MAX_LOOP_GAIN, 1e-3 ** (1 / (ring * hz)) / Math.cos(w0 / 2) / dampGain);

  const rand = random(seed);
  const line = new Float32Array(n);
  // The finger: noise low-passed relative to the pitch (a damped string starts darker still).
  const ex = Math.exp((-2 * Math.PI * Math.min(6000, (muted ? MUTED_EXCITE_CUTOFF_X : EXCITE_CUTOFF_X) * hz)) / sampleRate);
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    lp = ex * lp + (1 - ex) * (rand() * 2 - 1);
    line[i] = lp;
    mean += lp / n;
  }
  for (let i = 0; i < n; i++) line[i] -= mean;

  const length = Math.floor(sampleRate * seconds);
  const out = new Float32Array(length);
  let idx = 0;
  let prev = 0;
  let apIn = 0;
  let apOut = 0;
  let z = 0;
  for (let i = 0; i < length; i++) {
    const x = line[idx];
    out[i] = x;
    const avg = 0.5 * (x + prev);
    prev = x;
    z = damp * z + (1 - damp) * avg;
    const ap = c * z + apIn - c * apOut;
    apIn = z;
    apOut = ap;
    line[idx] = ap * loss;
    idx = idx + 1 === n ? 0 : idx + 1;
  }
  const fade = Math.floor(sampleRate * Math.min(0.25, seconds / 4));
  for (let i = 0; i < fade; i++) out[length - fade + i] *= 1 - (i + 1) / fade;
  return normalise(out, 0.9);
}

/**
 * A small room's impulse response, one array per channel: a few early
 * reflections, then a decaying noise tail that darkens as it fades.
 * Channels use different noise so the sheet gains width.
 */
export function roomImpulse(sampleRate: number, { seconds = 1.8, decay = 1.4, seed = 7 } = {}): [Float32Array, Float32Array] {
  const length = Math.floor(sampleRate * seconds);
  const reflections = [
    [0.011, 0.5],
    [0.019, 0.35],
    [0.027, 0.3],
    [0.041, 0.22],
  ] as const;
  const channel = (seed: number, skew: number) => {
    const rand = random(seed);
    const out = new Float32Array(length);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Low-pass that closes over time: a damped tail sounds like a room, not a hiss.
      const k = Math.min(0.95, 0.2 + t / seconds);
      lp = k * lp + (1 - k) * (rand() * 2 - 1);
      out[i] = lp * 10 ** ((-3 * t) / decay) * Math.min(1, t / 0.008);
    }
    for (const [at, g] of reflections) out[Math.floor((at + skew) * sampleRate)] += g * (rand() < 0.5 ? -1 : 1);
    return normalise(out, 0.5);
  };
  return [channel(seed, 0), channel(seed + 1, 0.003)];
}

/** Golpe: a knuckle tap on the top — a low thump plus a short click. */
export function golpeBurst(sampleRate: number, seed = 1): Float32Array {
  const rand = random(seed);
  const length = Math.floor(sampleRate * 0.18);
  const out = new Float32Array(length);
  let lp = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const thump = Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t / 0.035);
    lp = lp * 0.5 + (rand() * 2 - 1) * 0.5;
    const click = lp * Math.exp(-t / 0.012);
    out[i] = 0.8 * thump + 0.6 * click;
  }
  return normalise(out, 0.8);
}

/**
 * Natural harmonic: a bell-like, nearly pure tone that rings long, with a
 * soft attack (the finger only touches the string at the node).
 */
export function harmonicTone(midi: number, sampleRate: number, { seconds = 4 } = {}): Float32Array {
  const hz = hzOf(midi);
  const length = Math.floor(sampleRate * seconds);
  const out = new Float32Array(length);
  const attack = 0.004;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / attack) * 10 ** ((-3 * t) / 4);
    out[i] = env * (Math.sin(2 * Math.PI * hz * t) + 0.08 * Math.sin(4 * Math.PI * hz * t) * Math.exp(-t / 0.3));
  }
  const fade = Math.floor(sampleRate * 0.25);
  for (let i = 0; i < fade; i++) out[length - fade + i] *= 1 - (i + 1) / fade;
  return normalise(out, 0.7);
}

/**
 * Slap: the thumb's side hits the bass strings against the frets — a low
 * thud plus a bright snap of strings on metal.
 */
export function slapBurst(sampleRate: number, seed = 3): Float32Array {
  const rand = random(seed);
  const length = Math.floor(sampleRate * 0.14);
  const out = new Float32Array(length);
  let lp = 0;
  let prev = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const thud = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t / 0.045);
    lp = lp * 0.3 + (rand() * 2 - 1) * 0.7;
    const snap = (lp - prev) * Math.exp(-t / 0.008); // high-passed: the metal snap
    prev = lp;
    out[i] = 0.9 * thud + 0.7 * snap;
  }
  return normalise(out, 0.85);
}

/** Apagado: the hand lands on the strings to stop a strum — a short, dull chunk. */
export function apagadoChunk(sampleRate: number, seed = 5): Float32Array {
  const rand = random(seed);
  const length = Math.floor(sampleRate * 0.06);
  const out = new Float32Array(length);
  let lp = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    lp = lp * 0.8 + (rand() * 2 - 1) * 0.2;
    out[i] = lp * Math.exp(-t / 0.012);
  }
  return normalise(out, 0.5);
}

/** Semitones a natural harmonic sounds above the open string, by node fret. */
const HARMONIC_INTERVAL: Record<number, number> = { 12: 12, 7: 19, 5: 24 };

export type NoteSound =
  | { kind: 'pluck' | 'muted' | 'harmonic' | 'legato'; midi: number }
  | { kind: 'golpe' | 'slap' | 'apagado' };

/** Which sound a note makes, and at what pitch (engine-spec §3 techniques). */
export function soundOf(e: NoteEvent, capo: number): NoteSound {
  if (e.fret < 0) return { kind: e.tech === 'slap' ? 'slap' : e.tech === 'apagado' ? 'apagado' : 'golpe' };
  if (e.tech === 'harmonic') return { kind: 'harmonic', midi: midiOf(e.string, 0, capo) + (HARMONIC_INTERVAL[e.fret] ?? 12) };
  const midi = midiOf(e.string, e.fret, capo);
  if (e.tech === 'palm-mute') return { kind: 'muted', midi };
  if (e.tech === 'hammer' || e.tech === 'pull') return { kind: 'legato', midi };
  return { kind: 'pluck', midi };
}

/** Human timing (M9, measured: players sit 15–23 ms off the grid; we were at ±6). */
const JITTER_MS = 9;
/** Phrases push and pull: a slow drift over 8 bars, up to this far ahead or behind. */
const PHRASE_PUSH_MS = 7;
const PHRASE_BARS = 8;
/** Touch varies from note to note (measured spread 3–6 dB; ours was ~3). */
const TOUCH_SPREAD = 0.22;
/** The beat's own weight: a little more on the beat, a little less on the off-sixteenths. */
const ON_BEAT = 1.08;
const OFF_SIXTEENTH = 0.9;

export type Human = { offsetSec: number; gain: number };

/**
 * How a person would play each event (engine-spec §6 humanising): a small
 * timing jitter plus a phrase-long push and pull, and a touch that varies,
 * a little heavier on the beat. Notes struck together (a pinch, a strum)
 * move together. Deterministic for a seed, so a sheet always plays the same.
 */
export function humanize(events: readonly NoteEvent[], beatsPerBar: number, seed = 1): Human[] {
  const rand = random(seed);
  const bar = beatsPerBar * 480;
  const byTick = new Map<number, Human>();
  return events.map((e) => {
    const shared = byTick.get(e.tick);
    const jitter = shared ? shared.offsetSec * 1000 - phrase(e.tick) : (rand() + rand() - 1) * JITTER_MS;
    const offsetMs = phrase(e.tick) + jitter;
    const beat = e.tick % 480 === 0 ? ON_BEAT : e.tick % 240 !== 0 ? OFF_SIXTEENTH : 1;
    const h = { offsetSec: offsetMs / 1000, gain: beat * (1 + (rand() * 2 - 1) * TOUCH_SPREAD) };
    if (!shared) byTick.set(e.tick, h);
    return h;
  });
  function phrase(tick: number) {
    return PHRASE_PUSH_MS * Math.sin((2 * Math.PI * tick) / (bar * PHRASE_BARS) + seed);
  }
}

/** Seconds to delay each strummed note, by event index (rasgueado only). */
export function strumOffsets(events: readonly NoteEvent[], stepMs = STRUM_STEP_MS): Map<number, number> {
  const offsets = new Map<number, number>();
  const groups = new Map<string, number[]>();
  events.forEach((e, i) => {
    if (e.tech !== 'rasgueo-down' && e.tech !== 'rasgueo-up') return;
    const key = `${e.tick}:${e.tech}`;
    const g = groups.get(key) ?? [];
    g.push(i);
    groups.set(key, g);
  });
  for (const indexes of groups.values()) {
    const up = events[indexes[0]].tech === 'rasgueo-up';
    const order = [...indexes].sort((a, b) => (up ? events[b].string - events[a].string : events[a].string - events[b].string));
    order.forEach((i, rank) => {
      const explicit = events[i].strumOffsetMs;
      offsets.set(i, (explicit ?? rank * stepMs) / 1000);
    });
  }
  return offsets;
}

export type Feel = { strumMs: number; reverb: number; shelfDb: number; crisp: boolean };

/**
 * engine-spec §6 feel, from the mood's values: strum speed (ms between strings),
 * reverb send, a high shelf at 3 kHz (darker or brighter), and whether pattern
 * notes stop at their written length (crisp, when driving) or ring on.
 * Calm songs strum slower with more room; bright songs sound brighter.
 */
export function feelOf({ energy, valence }: Mood): Feel {
  return {
    strumMs: Math.round(20 - 12 * energy),
    reverb: Math.round((0.34 - 0.18 * energy) * 100) / 100,
    shelfDb: Math.round((-5 + 8 * valence) * 10) / 10,
    crisp: energy >= 0.5,
  };
}

/** The tune sits on top of the pattern. */
const MELODY_LIFT = 1.3;

/** Linear gain for a note: velocity, accents, the tune lifted, softer legato and a little more bass. */
export function noteGain(e: NoteEvent): number {
  let g = e.velocity * 0.62;
  if (e.melody) g *= MELODY_LIFT;
  if (e.accent) g *= 1.25;
  if (e.tech === 'hammer' || e.tech === 'pull') g *= 0.7;
  if (e.tech === 'apagado') g *= 0.8;
  if (e.string > 2) g *= 0.78;
  return Math.min(1, g);
}
