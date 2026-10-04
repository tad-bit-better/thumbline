import type { NoteEvent } from '@thumbline/engine';

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

/** Ring time to −60 dB: about 3.2 s on the low E down to 1 s high up the neck. */
function t60(hz: number) {
  const pos = Math.min(1, Math.max(0, Math.log2(hz / 82) / Math.log2(1300 / 82)));
  return 3.2 + (1 - 3.2) * pos;
}

export type PluckOptions = { seconds?: number; seed?: number };

/**
 * Nylon-string pluck by Karplus-Strong with a first-order allpass for
 * fractional delay, so high notes stay in tune (Jaffe & Smith).
 */
export function nylonPluck(midi: number, sampleRate: number, { seconds = 2.6, seed = midi }: PluckOptions = {}): Float32Array {
  const hz = hzOf(midi);
  const period = sampleRate / hz;
  // Loop delay = N (buffer) + 0.5 (averaging filter) + d (allpass), with d in (0.1, 1.1].
  const n = Math.floor(period - 0.6);
  const d = period - 0.5 - n;
  const c = (1 - d) / (1 + d);
  const loss = 1e-3 ** (1 / (t60(hz) * hz));

  const rand = random(seed);
  const line = new Float32Array(n);
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    lp = lp * 0.6 + (rand() * 2 - 1) * 0.4; // warm (low-passed) excitation for nylon
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
  for (let i = 0; i < length; i++) {
    const x = line[idx];
    out[i] = x;
    const avg = 0.5 * (x + prev);
    prev = x;
    const ap = c * avg + apIn - c * apOut;
    apIn = avg;
    apOut = ap;
    line[idx] = ap * loss;
    idx = idx + 1 === n ? 0 : idx + 1;
  }
  const fade = Math.floor(sampleRate * 0.25);
  for (let i = 0; i < fade; i++) out[length - fade + i] *= 1 - (i + 1) / fade;
  return normalise(out, 0.9);
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

/** Seconds to delay each strummed note, by event index (rasgueado only). */
export function strumOffsets(events: readonly NoteEvent[]): Map<number, number> {
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
      offsets.set(i, (explicit ?? rank * STRUM_STEP_MS) / 1000);
    });
  }
  return offsets;
}

/** Linear gain for a note: velocity, accents, softer legato and a little more bass. */
export function noteGain(e: NoteEvent): number {
  let g = e.velocity * 0.62;
  if (e.accent) g *= 1.25;
  if (e.tech === 'hammer' || e.tech === 'pull') g *= 0.7;
  if (e.string > 2) g *= 0.78;
  return Math.min(1, g);
}
