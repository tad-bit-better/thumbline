import { timeStretch, timeStretchAsync } from './stretch.js';

const SR = 44100;

const sine = (hz: number, seconds: number) =>
  Float32Array.from({ length: Math.floor(SR * seconds) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / SR));

/** Short decaying bursts every `every` seconds. */
function clicks(every: number, seconds: number) {
  const x = new Float32Array(Math.floor(SR * seconds));
  for (let t = 0.25; t < seconds - 0.1; t += every) {
    const at = Math.floor(t * SR);
    for (let i = 0; i < 400; i++) x[at + i] = Math.sin((2 * Math.PI * 1000 * i) / SR) * Math.exp(-i / 80);
  }
  return x;
}

function pitchHz(x: Float32Array, from: number, len: number) {
  let best = 0;
  let bestLag = 0;
  for (let lag = 20; lag < 400; lag++) {
    let s = 0;
    for (let i = 0; i < len; i++) s += x[from + i] * x[from + i + lag];
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  return SR / bestLag;
}

function onsets(x: Float32Array) {
  const found: number[] = [];
  const hop = 64;
  let quiet = true;
  for (let i = 0; i < x.length - hop; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e = Math.max(e, Math.abs(x[i + j]));
    if (quiet && e > 0.3) {
      found.push(i / SR);
      quiet = false;
    } else if (e < 0.02) quiet = true;
  }
  return found;
}

describe('timeStretch', () => {
  it('returns copies at full speed', () => {
    const x = sine(220, 0.5);
    const [y] = timeStretch([x], SR, 1);
    expect(y).toEqual(x);
    expect(y).not.toBe(x);
  });

  it.each([0.5, 0.75])('lengthens by 1/speed at %s', (speed) => {
    const [y] = timeStretch([sine(220, 2)], SR, speed);
    expect(Math.abs(y.length - (2 * SR) / speed)).toBeLessThan(SR * 0.01);
  });

  it.each([0.5, 0.75])('keeps the pitch at %s', (speed) => {
    const [y] = timeStretch([sine(440, 1.5)], SR, speed);
    const hz = pitchHz(y, Math.floor(y.length / 2), 2048);
    expect(Math.abs(1200 * Math.log2(hz / 440))).toBeLessThan(10);
  });

  it('keeps the level steady, with no dropouts', () => {
    const [y] = timeStretch([sine(330, 2)], SR, 0.5);
    const win = Math.floor(SR * 0.05);
    const levels: number[] = [];
    for (let i = SR / 2; i + win < y.length - SR / 2; i += win) {
      let s = 0;
      for (let j = 0; j < win; j++) s += y[i + j] ** 2;
      levels.push(Math.sqrt(s / win));
    }
    const mean = levels.reduce((a, b) => a + b) / levels.length;
    for (const l of levels) expect(Math.abs(l - mean) / mean).toBeLessThan(0.15);
  });

  it.each([0.5, 0.75])('moves transients to t / speed within 10 ms at %s', (speed) => {
    const x = clicks(0.5, 6);
    const [y] = timeStretch([x], SR, speed);
    const before = onsets(x);
    const after = onsets(y);
    expect(after).toHaveLength(before.length);
    after.forEach((t, i) => expect(Math.abs(t - before[i] / speed)).toBeLessThan(0.01));
  });

  it('stretches every channel with the same frames', () => {
    const x = sine(200, 1);
    const [l, r] = timeStretch([x, Float32Array.from(x)], SR, 0.75);
    expect(l.length).toBe(r.length);
    expect(r).toEqual(l);
  });

  it('rejects speeds outside (0, 1]', () => {
    expect(() => timeStretch([sine(220, 0.1)], SR, 0)).toThrow(/speed/);
    expect(() => timeStretch([sine(220, 0.1)], SR, 1.5)).toThrow(/speed/);
  });

  it('copes with input shorter than a frame', () => {
    const [y] = timeStretch([sine(220, 0.005)], SR, 0.5);
    expect(y.length).toBeGreaterThan(0);
  });

  it('stretches 30 s of audio quickly', () => {
    const x = sine(196, 30);
    const t0 = performance.now();
    timeStretch([x], SR, 0.5);
    expect(performance.now() - t0).toBeLessThan(4000);
  });
});

describe('timeStretchAsync', () => {
  it('matches the synchronous result while yielding to the event loop', async () => {
    const x = clicks(0.4, 3);
    const [a] = timeStretch([x], SR, 0.75);
    const [b] = await timeStretchAsync([x], SR, 0.75);
    expect(b).toEqual(a);
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const p = timeStretchAsync([sine(220, 10)], SR, 0.5, { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toThrow(/abort/i);
  });
});
