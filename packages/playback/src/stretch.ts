/**
 * WSOLA time-stretch: slows audio down without changing its pitch.
 * Frames of ~23 ms are overlap-added at a fixed output hop; each frame's
 * input position is nudged (±~6 ms) to the spot whose waveform best
 * continues the previous frame. Positions are chosen on a mono mix and
 * applied to every channel so stereo stays coherent.
 */

const FRAME_SEC = 0.023;
const TOLERANCE_SEC = 0.0058;
const DECIMATE = 4;

type Params = { frame: number; hop: number; tolerance: number; window: Float32Array };

function params(sampleRate: number): Params {
  const frame = 2 * Math.round((FRAME_SEC * sampleRate) / 2);
  const window = new Float32Array(frame);
  // Periodic Hann: overlaps at 50% sum to exactly 1.
  for (let i = 0; i < frame; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frame);
  return { frame, hop: frame / 2, tolerance: Math.round(TOLERANCE_SEC * sampleRate), window };
}

/** Samples processed between yields while preparing (keeps long clips from blocking). */
const PREP_CHUNK = 1 << 16;

function* mixdown(channels: readonly Float32Array[]): Generator<void, Float32Array> {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (let start = 0; start < out.length; start += PREP_CHUNK) {
    const end = Math.min(out.length, start + PREP_CHUNK);
    for (const ch of channels) for (let i = start; i < end; i++) out[i] += ch[i] / channels.length;
    yield;
  }
  return out;
}

function* decimate(x: Float32Array): Generator<void, Float32Array> {
  const out = new Float32Array(Math.floor(x.length / DECIMATE));
  for (let start = 0; start < out.length; start += PREP_CHUNK) {
    const end = Math.min(out.length, start + PREP_CHUNK);
    for (let i = start; i < end; i++) {
      let s = 0;
      for (let j = 0; j < DECIMATE; j++) s += x[i * DECIMATE + j];
      out[i] = s / DECIMATE;
    }
    yield;
  }
  return out;
}

function correlate(x: Float32Array, a: number, b: number, len: number, step = 1) {
  let s = 0;
  for (let i = 0; i < len; i += step) s += x[a + i] * x[b + i];
  return s;
}

/** Generator so the sync and async versions share one implementation; yields between frames. */
function* stretchSteps(channels: readonly Float32Array[], sampleRate: number, speed: number): Generator<void, Float32Array[]> {
  if (!(speed > 0 && speed <= 1)) throw new RangeError(`speed must be in (0, 1], got ${speed}`);
  if (speed === 1) return channels.map((c) => Float32Array.from(c));

  const { frame, hop, tolerance, window } = params(sampleRate);
  const input = channels[0].length;
  const length = Math.ceil(input / speed);
  const outs = channels.map(() => new Float32Array(length));
  const weight = new Float32Array(length + frame);
  if (input < frame) {
    // Too short to stretch meaningfully: hold the samples.
    for (let c = 0; c < channels.length; c++) for (let i = 0; i < length; i++) outs[c][i] = channels[c][Math.floor(i * speed)];
    return outs;
  }

  const mono: Float32Array = yield* mixdown(channels);
  const coarse: Float32Array = yield* decimate(mono);
  const lastStart = input - frame;
  const overlap = frame - hop;
  let prev = 0;

  for (let k = 0, out = 0; out < length; k++, out += hop) {
    let pos: number;
    if (k === 0) pos = 0;
    else {
      const target = Math.min(lastStart, Math.round(k * hop * speed));
      const natural = Math.min(lastStart, prev + hop);
      const lo = Math.max(0, target - tolerance);
      const hi = Math.min(lastStart, target + tolerance);
      // Coarse search on the decimated signal, then refine at full rate.
      let best = target;
      let bestScore = -Infinity;
      const n = Math.floor(natural / DECIMATE);
      const len = Math.floor(overlap / DECIMATE);
      for (let p = lo; p <= hi; p += DECIMATE) {
        const score = correlate(coarse, n, Math.floor(p / DECIMATE), Math.min(len, coarse.length - Math.floor(p / DECIMATE)));
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      bestScore = -Infinity;
      let refined = best;
      for (let p = Math.max(lo, best - DECIMATE + 1); p <= Math.min(hi, best + DECIMATE - 1); p++) {
        const score = correlate(mono, natural, p, overlap, 2);
        if (score > bestScore) {
          bestScore = score;
          refined = p;
        }
      }
      pos = refined;
    }
    prev = pos;
    const count = Math.min(frame, length - out);
    for (let c = 0; c < channels.length; c++) {
      const src = channels[c];
      const dst = outs[c];
      for (let i = 0; i < count; i++) dst[out + i] += window[i] * src[pos + i];
    }
    for (let i = 0; i < count; i++) weight[out + i] += window[i];
    yield;
  }

  // Edges get less than full window overlap; normalise by the summed window.
  for (let i = 0; i < length; i++) {
    const w = weight[i] > 1e-3 ? weight[i] : 1;
    for (const dst of outs) dst[i] /= w;
  }
  return outs;
}

/** Stretch all channels to 1/speed of their length, pitch unchanged. */
export function timeStretch(channels: readonly Float32Array[], sampleRate: number, speed: number): Float32Array[] {
  const steps = stretchSteps(channels, sampleRate, speed);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** Yield a macrotask so the page stays responsive (not tied to timers). */
function yieldToEventLoop(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/** Same result as `timeStretch`, yielding to the event loop every few ms. */
export async function timeStretchAsync(
  channels: readonly Float32Array[],
  sampleRate: number,
  speed: number,
  { signal, sliceMs = 8 }: { signal?: AbortSignal; sliceMs?: number } = {},
): Promise<Float32Array[]> {
  const steps = stretchSteps(channels, sampleRate, speed);
  for (;;) {
    const sliceEnd = performance.now() + sliceMs;
    for (;;) {
      if (signal?.aborted) throw new DOMException('Time-stretch aborted', 'AbortError');
      const r = steps.next();
      if (r.done) return r.value;
      if (performance.now() >= sliceEnd) break;
    }
    await yieldToEventLoop();
  }
}
