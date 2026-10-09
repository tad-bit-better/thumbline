import type { Arrangement, NoteEvent } from '@thumbline/engine';
import { createPlayer } from './player.js';
import { TOUCH_LEVELS, nylonPluck, touchLevelOf } from './synth.js';
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

function setup(a: Arrangement, extra: { original?: FakeBuffer; beats?: { beatTimesSec: number[]; barStartBeat: number }; humanize?: boolean; tuningCents?: number } = {}) {
  const ctx = new FakeAudioContext(SR);
  const cursor: number[] = [];
  const onEnd = vi.fn();
  const player = createPlayer({
    arrangement: a,
    context: ctx as unknown as AudioContext,
    onCursor: (i) => cursor.push(i),
    onEnd,
    // The clock tests check exact times; humanising has its own test.
    humanize: false,
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
  it('plays the sheet at the recording\'s tuning', async () => {
    const one = arrangement([{ tick: 0, string: 4, fret: 0, velocity: 0.8 }]);
    const { ctx, player, run } = setup(one, { tuningCents: -30 });
    await player.play();
    await run(0.2);
    const [note] = notes(ctx);
    const touch = TOUCH_LEVELS[touchLevelOf(0.8)];
    // The open B string (MIDI 59), 30 cents flat.
    expect([...(note.buffer as FakeBuffer).getChannelData(0).slice(0, 400)]).toEqual([...nylonPluck(58.7, SR, { touch, seed: 59 }).slice(0, 400)]);
  });

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

  it('makes only the opening notes before playing, and the rest while it plays', async () => {
    // 16 bars of different notes, 0.5 s apart.
    const long = arrangement(
      Array.from({ length: 64 }, (_, i) => ({ tick: i * 480, string: 4, fret: i })),
      16,
    );
    const { ctx, player, run, started } = setup(long);
    const made = vi.spyOn(ctx, 'createBuffer');
    await player.play();
    // The first two seconds: a handful of notes, not all 64.
    expect(made.mock.calls.length).toBeGreaterThan(0);
    expect(made.mock.calls.length).toBeLessThanOrEqual(6);
    await run(1);
    expect(made.mock.calls.length).toBe(64);
    await run(33);
    expect(started()).toHaveLength(64);
  });

  it('keeps the notes it made for the next arrangement on the same context', async () => {
    const a = quarters(2);
    const { ctx, player, run } = setup(a);
    await player.play();
    await run(1);
    player.dispose();
    const before = ctx.sources.length;
    const made = vi.spyOn(ctx, 'createBuffer');
    const again = createPlayer({ arrangement: a, context: ctx as unknown as AudioContext, onCursor: () => undefined, humanize: false });
    await again.play();
    await run(5);
    // Only the room's impulse response: every note was already made.
    expect(made.mock.calls.length).toBe(1);
    expect(ctx.sources.slice(before).filter((s) => s.started !== undefined)).toHaveLength(8);
  });

  it('spreads strings across the stereo field, low left and high right', async () => {
    const a = arrangement([
      { tick: 0, string: 0, fret: 0 },
      { tick: 480, string: 5, fret: 0 },
    ]);
    const { ctx, player, run } = setup(a);
    await player.play();
    await run(1.2);
    const [low, high] = notes(ctx).map((s) => s.connected[0] as { connected: unknown[] }); // source → note gain
    const panOf = (gain: { connected: unknown[] }) => ctx.panners.find((p) => gain.connected.includes(p));
    expect(panOf(low)?.pan.value).toBeLessThan(0);
    expect(panOf(high)?.pan.value).toBeGreaterThan(0);
    const [, sheetBus] = ctx.gains;
    expect(ctx.panners.every((p) => p.connected.includes(sheetBus))).toBe(true);
  });

  it('sends the sheet, not the original, through a small room', () => {
    const { ctx } = setup(quarters(1), { original: clickTrack(1) });
    const [master, sheetBus, originalBus] = ctx.gains;
    const [room] = ctx.convolvers;
    const send = ctx.gains.find((g) => g.connected.includes(room));
    expect(room.buffer?.numberOfChannels).toBe(2);
    expect(sheetBus.connected).toContain(send);
    expect(originalBus.connected).not.toContain(send);
    expect(room.connected).toContain(master);
    expect(send?.gain.value).toBeGreaterThan(0);
    expect(send?.gain.value).toBeLessThan(0.5);
  });

  describe('with the original recording', () => {
    it('plays like a person when humanising: every note within 20 ms of its time, not exactly on it', async () => {
    const { ctx, player, run } = setup(quarters(1), { humanize: true });
    await player.play();
    await run(2.5);
    const n = notes(ctx);
    const t0 = when(n[0]);
    const off = n.map((s, i) => Math.abs(when(s) - t0 - i * 0.5));
    expect(Math.max(...off)).toBeLessThan(0.04);
    expect(off.some((o) => o > 0.0005)).toBe(true);
  });

  it('starts both from any point in the song', async () => {
      const original = clickTrack(5);
      const { ctx, player, run, cursor } = setup(quarters(2), { original });
      // Halfway through beat 2 of bar 2: 4.5 beats at 120 bpm = 2.25 s.
      await player.playFrom(480 * 4.5);
      await run(0.4);
      const [rec] = ctx.sources.filter((s) => s.buffer === original);
      expect(rec.started).toMatchObject({ offset: expect.closeTo(2.25, 6) });
      // The first note heard is the next one: beat 6 (index 5), half a beat later.
      const [first] = notes(ctx, original);
      expect(when(first) - (rec.started as { when: number }).when).toBeCloseTo(0.25, 6);
      expect(cursor[0]).toBe(5);
    });

    it('jumps when asked to play from elsewhere while playing', async () => {
      const original = clickTrack(5);
      const { ctx, player, run } = setup(quarters(2), { original });
      await player.play();
      await run(0.3);
      await player.playFrom(480 * 6);
      await run(0.1);
      const recs = ctx.sources.filter((s) => s.buffer === original);
      expect(recs[0].stopAt).toBeDefined();
      expect(recs.at(-1)?.started).toMatchObject({ offset: expect.closeTo(3, 6) });
      expect(player.state).toBe('playing');
    });

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

    it('turns the original down under the sheet in Both, on a loudness curve', () => {
      const original = clickTrack(3);
      const { ctx, player } = setup(quarters(1), { original });
      const [, sheetBus, originalBus] = ctx.gains;
      player.setMix('both');
      player.setOriginalLevel(0.5);
      expect([sheetBus.gain.value, originalBus.gain.value]).toEqual([1, 0.25]);
      player.setOriginalLevel(0);
      expect(originalBus.gain.value).toBe(0);
      player.setOriginalLevel(2);
      expect(originalBus.gain.value).toBe(1);
      // Original alone stays at full level.
      player.setOriginalLevel(0.3);
      player.setMix('original');
      expect(originalBus.gain.value).toBe(1);
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
