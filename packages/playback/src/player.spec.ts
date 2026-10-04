import type { Arrangement, NoteEvent } from '@thumbline/engine';
import { createPlayer } from './player.js';
import { FakeAudioContext, type FakeBuffer, type FakeSource } from './testing/fake-audio.js';

const SR = 8000;

function arrangement(events: Array<Partial<NoteEvent> & Pick<NoteEvent, 'tick' | 'string' | 'fret'>>, bars = 1, bpm = 120): Arrangement {
  return {
    style: 'arpeggio',
    level: 'basic',
    patternId: 'test',
    capo: 0,
    meter: { beatsPerBar: 4 },
    bpm,
    bars,
    chordMarks: [],
    events: events.map((e) => ({ dur: 480, finger: 'i' as const, velocity: 0.8, ...e })),
    warnings: [],
  };
}

/** Quarter notes on the B string for `bars` bars at 120 bpm (0.5 s apart). */
const quarters = (bars: number) =>
  arrangement(
    Array.from({ length: bars * 4 }, (_, i) => ({ tick: i * 480, string: 4, fret: i % 3 })),
    bars,
  );

function setup(a: Arrangement, extra: { original?: FakeBuffer; beats?: { beatTimesSec: number[]; barStartBeat: number } } = {}) {
  const ctx = new FakeAudioContext(SR);
  const cursor: number[] = [];
  const onEnd = vi.fn();
  const player = createPlayer({
    arrangement: a,
    context: ctx as unknown as AudioContext,
    onCursor: (i) => cursor.push(i),
    onEnd,
    ...(extra as object),
  } as Parameters<typeof createPlayer>[0]);
  const run = async (seconds: number) => {
    for (let ms = 0; ms < seconds * 1000; ms += 5) {
      ctx.currentTime += 0.005;
      await vi.advanceTimersByTimeAsync(5);
    }
  };
  const started = (pred: (s: FakeSource) => boolean = () => true) =>
    ctx.sources.filter((s) => s.started !== undefined && pred(s));
  return { ctx, player, cursor, onEnd, run, started };
}

const notes = (ctx: FakeAudioContext, original?: FakeBuffer) =>
  ctx.sources.filter((s) => s.started !== undefined && s.buffer !== original);
const when = (s: FakeSource) => (s.started as { when: number }).when;

function clickTrack(seconds: number) {
  const ctx = new FakeAudioContext(SR);
  const b = ctx.createBuffer(2, Math.floor(seconds * SR), SR);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i / 3) * 0.2;
  }
  return b;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createPlayer', () => {
  it('schedules every note at its time on the audio clock', async () => {
    const { ctx, player, run } = setup(quarters(1));
    await player.play();
    await run(2.5);
    const n = notes(ctx);
    expect(n).toHaveLength(4);
    const t0 = when(n[0]);
    n.forEach((s, i) => expect(when(s) - t0).toBeCloseTo(i * 0.5, 6));
  });

  it('moves the cursor only once each note is audible, in order', async () => {
    const { ctx, player, run, cursor } = setup(quarters(1));
    await player.play();
    const first = when(notes(ctx)[0] ?? ({ started: { when: Infinity } } as FakeSource));
    await run(0.01);
    expect(cursor).toEqual([]);
    await run(Math.max(0, first - ctx.currentTime) + 0.03);
    expect(cursor).toEqual([0]);
    await run(2);
    expect(cursor).toEqual([0, 1, 2, 3]);
  });

  it('accounts for output latency', async () => {
    const { ctx, player, run, cursor } = setup(quarters(1));
    ctx.outputLatency = 0.2;
    await player.play();
    await run(0.15);
    const t0 = when(notes(ctx)[0]);
    await run(t0 - ctx.currentTime + 0.1);
    expect(cursor).toEqual([]);
    await run(0.15);
    expect(cursor).toEqual([0]);
  });

  it('staggers rasgueado strokes and uses a noise burst for golpe', async () => {
    const strum = [0, 1, 2, 3, 4, 5].map((s) => ({ tick: 0, string: s, fret: 0, tech: 'rasgueo-down' as const }));
    const { ctx, player, run } = setup(arrangement([...strum, { tick: 960, string: 0, fret: -1, tech: 'golpe' }]));
    await player.play();
    await run(1.5);
    const n = notes(ctx);
    const t0 = when(n[0]);
    expect(n.slice(0, 6).map((s) => Math.round((when(s) - t0) * 1000))).toEqual([0, 12, 24, 36, 48, 60]);
    const golpe = n[6];
    expect(golpe.buffer?.duration).toBeLessThan(0.25);
  });

  it('cuts the previous note on the same string', async () => {
    const { ctx, player, run } = setup(quarters(1));
    await player.play();
    await run(1);
    const gains = ctx.gains.filter((g) => g.gain.events.some(([kind, v]) => kind === 'target' && v === 0));
    expect(gains.length).toBeGreaterThanOrEqual(1);
  });

  it('reports the end of the song once and stops', async () => {
    const { player, run, onEnd } = setup(quarters(1));
    await player.play();
    await run(3);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(player.state).toBe('idle');
  });

  it('stops every sound and the cursor on stop()', async () => {
    const { ctx, player, run, cursor } = setup(quarters(2));
    await player.play();
    await run(0.8);
    player.stop();
    const count = cursor.length;
    for (const s of notes(ctx)) expect(s.stopAt).toBeDefined();
    await run(2);
    expect(cursor).toHaveLength(count);
    expect(player.state).toBe('idle');
  });

  it('plays from a bar', async () => {
    const { player, run, cursor } = setup(quarters(2));
    await player.play(1);
    await run(0.4);
    expect(cursor).toEqual([4]);
  });

  it('loops a bar range', async () => {
    const { player, run, cursor } = setup(quarters(2));
    player.setLoop(1, 1);
    await player.play();
    await run(4.6);
    expect(cursor.slice(0, 8)).toEqual([4, 5, 6, 7, 4, 5, 6, 7]);
    player.setLoop(null);
  });

  describe('with the original recording', () => {
    it('starts the recording on the same clock, aligned to the beats', async () => {
      const original = clickTrack(4);
      const beats = { beatTimesSec: [0.3, 0.8, 1.3, 1.8, 2.3], barStartBeat: 0 };
      const { ctx, player, run } = setup(quarters(1), { original, beats });
      await player.play();
      await run(0.3);
      const [rec] = ctx.sources.filter((s) => s.buffer === original);
      const [first] = notes(ctx, original);
      expect(rec.started).toMatchObject({ offset: expect.closeTo(0.3, 6) });
      expect(when(first)).toBeCloseTo((rec.started as { when: number }).when, 6);
    });

    it('mixes sheet and original', async () => {
      const original = clickTrack(3);
      const { ctx, player } = setup(quarters(1), { original });
      const [, sheetBus, originalBus] = ctx.gains;
      player.setMix('sheet');
      expect([sheetBus.gain.value, originalBus.gain.value]).toEqual([1, 0]);
      player.setMix('original');
      expect([sheetBus.gain.value, originalBus.gain.value]).toEqual([0, 1]);
      player.setMix('both');
      expect(sheetBus.gain.value).toBe(1);
      expect(originalBus.gain.value).toBeGreaterThan(0);
    });

    it('slows down on a stretched copy, keeping both in step', async () => {
      const original = clickTrack(6);
      const { ctx, player, run } = setup(quarters(2), { original });
      await player.play();
      await run(1);
      await player.setTempoRatio(0.5);
      await run(1);
      const recs = ctx.sources.filter((s) => s.buffer && s.buffer !== original && s.buffer.length > original.length);
      expect(recs).toHaveLength(1);
      const slow = recs[0];
      expect(slow.buffer?.duration).toBeCloseTo(12, 1);
      const [first] = ctx.sources.filter((s) => s.buffer === original);
      expect(first.stopAt).toBeCloseTo((slow.started as { when: number }).when, 6);
      // The stretched copy starts at song time × 2.
      const songAtSwitch = (slow.started as { offset: number }).offset * 0.5;
      const startedAt = (first.started as { when: number }).when;
      expect(songAtSwitch).toBeCloseTo((slow.started as { when: number }).when - startedAt, 2);
    });

    it('ignores the original in the mix when there is none', () => {
      const { ctx, player } = setup(quarters(1));
      player.setMix('original');
      const [, sheetBus] = ctx.gains;
      expect(sheetBus.gain.value).toBe(1);
    });
  });

  it('clamps the tempo ratio to 50–100%', async () => {
    const { player } = setup(quarters(1));
    await player.setTempoRatio(0.2);
    expect(player.tempoRatio).toBe(0.5);
    await player.setTempoRatio(3);
    expect(player.tempoRatio).toBe(1);
  });
});
