import type { Arrangement } from '@thumbline/engine';
import { type Scheduler, createScheduler } from './scheduler.js';
import { timeStretchAsync } from './stretch.js';
import { BRUSH_STEP_MS, type NoteSound, STRUM_STEP_MS, TOUCH_LEVELS, feelOf, humanize, apagadoChunk, golpeBurst, harmonicTone, noteGain, nylonPluck, roomImpulse, slapBurst, soundOf, strumOffsets } from './synth.js';
import { type Beats, TICKS_PER_BEAT, createTimeline } from './timeline.js';

export type Mix = 'sheet' | 'original' | 'both';
export type PlayerState = 'idle' | 'preparing' | 'playing';

export type PlayerOptions = {
  arrangement: Arrangement;
  /** The uploaded clip, decoded. Enables the Original and Both mixes. */
  original?: AudioBuffer;
  /** Beat grid from the AnalysisResult, so the sheet follows the recording's tempo drift. */
  beats?: Beats;
  /** Index into `arrangement.events` of the note being heard. */
  onCursor: (eventIndex: number) => void;
  /** The song played to its end (not called on stop or while looping). */
  onEnd?: () => void;
  onStateChange?: (state: PlayerState) => void;
  /** Diagnostics: the audio-clock time each note was scheduled for. */
  onScheduled?: (eventIndex: number, audioTime: number) => void;
  /** Supply a context to share one; otherwise the player creates and owns it. */
  context?: AudioContext;
  /** Play like a person: small timing and touch variations (default true). */
  humanize?: boolean;
  /** The recording's tuning, cents from A440 (`AnalysisResult.tuningCents`): the sheet plays at the same pitch, so Both sounds in tune. */
  tuningCents?: number;
};

export type Player = {
  /** Play from the start of bar `fromBar` (0-based). */
  play: (fromBar?: number) => Promise<void>;
  /** Play from any point in the song, in arrangement ticks (restarts if already playing). */
  playFrom: (tick: number) => Promise<void>;
  stop: () => void;
  /** 0.5–1. Pitch is unchanged; the original is time-stretched first if needed. */
  setTempoRatio: (ratio: number) => Promise<void>;
  /** Loop bars `barStart`–`barEnd` (0-based, inclusive); `null` clears it. */
  setLoop: (barStart: number | null, barEnd?: number) => void;
  setMix: (mix: Mix) => void;
  /** How loud the original is under the sheet in Both, 0–1 (default 0.9), heard as level² so the slider feels even. */
  setOriginalLevel: (level: number) => void;
  dispose: () => void;
  readonly state: PlayerState;
  readonly tempoRatio: number;
};

const LOOKAHEAD_SEC = 0.15;
const TICK_MS = 25;
const START_DELAY_SEC = 0.06;
/** How fast a string is damped when the next note on it starts. */
const DAMP_SEC = 0.03;
/** A hammer-on or pull-off starts past the pluck's noisy attack and swells in. */
const LEGATO_SKIP_SEC = 0.02;
const LEGATO_RISE_SEC = 0.004;
/** Body resonances (Hz, dB, Q), as in the M9 spike renders. */
const BODY_EQ: ReadonlyArray<readonly [number, number, number]> = [
  [105, 5, 2],
  [230, 2.5, 1.4],
  [5200, -3, 0.8],
];
/** Vibrato on held melody notes: it starts after a moment, like a singer's. */
const VIBRATO_MIN_SEC = 0.45;
const VIBRATO_DELAY_SEC = 0.25;
const VIBRATO_HZ = 5.5;
const VIBRATO_CENTS = 15;
/** How fast a crisp note dies at its end (time constant). */
const CRISP_RELEASE_SEC = 0.03;
/** How much of the sheet goes to the room reverb (the original has its own room). */
const REVERB_SEND = 0.22;
/** Stereo spread of the strings: low E this far left, high E as far right. */
const STRING_PAN = 0.25;
const DEFAULT_ORIGINAL_LEVEL = 0.9;
const MIX_GLIDE_SEC = 0.02;
const MIN_RATIO = 0.5;
/**
 * An output timestamp is trusted only if it was taken within this long before now, and no further ahead than
 * this: WebKit on Linux reports performanceTime as performance.now() + contextTime, which would put what is
 * heard at zero for good (the e2e playhead never appeared there).
 */
const TIMESTAMP_MAX_AGE_MS = 1000;
const TIMESTAMP_MAX_AHEAD_MS = 50;
/** Notes made before the first one plays: this much of the song from the start point. The rest are made while it plays. */
const PREPARE_SEC = 2;
/** Making notes in the background: at most this long at a time, so the page keeps answering. */
const SLICE_MS = 8;

/** Notes already made, per context: a new arrangement on the same context (another pattern, a chord edit) reuses them. */
const madeNotes = new WeakMap<object, Map<string, AudioBuffer>>();

type Frame = (cb: () => void) => () => void;
const nextFrame: Frame =
  typeof requestAnimationFrame === 'function'
    ? (cb) => {
        const id = requestAnimationFrame(cb);
        return () => cancelAnimationFrame(id);
      }
    : (cb) => {
        const id = setTimeout(cb, 16);
        return () => clearTimeout(id);
      };

/** Sheet synth plus the original recording on one Web Audio clock (engine-spec §6). */
export function createPlayer(options: PlayerOptions): Player {
  const { arrangement: a, original, beats, onCursor, onEnd, onStateChange, onScheduled } = options;
  const ownsContext = !options.context;
  const ctx = options.context ?? new AudioContext({ latencyHint: 'interactive' });

  const feel = a.feel ? feelOf(a.feel) : { strumMs: STRUM_STEP_MS, brushMs: BRUSH_STEP_MS, reverb: REVERB_SEND, shelfDb: 0, crisp: false };
  const master = ctx.createGain();
  const sheetBus = ctx.createGain();
  const originalBus = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  master.gain.value = 0.9;
  // A guitar body under the strings: a low "box" resonance, a little warmth, softer pick noise.
  if (typeof ctx.createBiquadFilter === 'function') {
    let into: AudioNode = sheetBus;
    for (const [hz, db, q] of BODY_EQ) {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = hz;
      f.gain.value = db;
      f.Q.value = q;
      into.connect(f);
      into = f;
    }
    // The mood's colour: darker for sad songs, brighter for happy ones.
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 3000;
    shelf.gain.value = feel.shelfDb;
    into.connect(shelf);
    shelf.connect(master);
  } else sheetBus.connect(master);
  originalBus.connect(master);
  master.connect(compressor);
  compressor.connect(ctx.destination);

  // Sheet only: strings spread across the stereo field, and a small room after the mix gain,
  // so muting the sheet mutes its reverb too.
  const stringBus: AudioNode[] = Array.from({ length: 6 }, (_, s) => {
    if (typeof ctx.createStereoPanner !== 'function') return sheetBus;
    const pan = ctx.createStereoPanner();
    pan.pan.value = STRING_PAN * ((2 * s) / 5 - 1);
    pan.connect(sheetBus);
    return pan;
  });
  if (typeof ctx.createConvolver === 'function') {
    const send = ctx.createGain();
    send.gain.value = feel.reverb;
    const room = ctx.createConvolver();
    const ir = roomImpulse(ctx.sampleRate);
    const buffer = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
    ir.forEach((x, c) => buffer.copyToChannel(x as Float32Array<ArrayBuffer>, c));
    room.buffer = buffer;
    sheetBus.connect(send);
    send.connect(room);
    room.connect(master);
  }

  const timeline = createTimeline(a, beats);
  const eventSec = a.events.map((e) => timeline.tickToSec(e.tick));
  const strum = strumOffsets(a.events, feel.strumMs, feel.brushMs);
  const human = options.humanize === false ? a.events.map(() => ({ offsetSec: 0, gain: 1 })) : humanize(a.events, a.meter.beatsPerBar);

  const sounds = a.events.map((e) => soundOf(e, a.capo));
  let buffers = madeNotes.get(ctx);
  if (!buffers) madeNotes.set(ctx, (buffers = new Map<string, AudioBuffer>()));
  /** The recording's tuning, in semitones. */
  const tune = (options.tuningCents ?? 0) / 100;
  const soundKey = (n: NoteSound) => ('midi' in n ? `${n.kind === 'legato' ? 'pluck' : n.kind}:${n.midi + tune}:${n.touch}` : n.kind);
  const toBuffer = (data: Float32Array) => {
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    return b;
  };
  const render = (n: NoteSound): Float32Array => {
    const sr = ctx.sampleRate;
    switch (n.kind) {
      case 'golpe':
        return golpeBurst(sr);
      case 'slap':
        return slapBurst(sr);
      case 'apagado':
        return apagadoChunk(sr);
      case 'harmonic':
        return harmonicTone(n.midi + tune, sr);
      case 'muted':
        return nylonPluck(n.midi + tune, sr, { muted: true, touch: TOUCH_LEVELS[n.touch], seed: n.midi });
      case 'pluck':
      case 'legato':
        return nylonPluck(n.midi + tune, sr, { touch: TOUCH_LEVELS[n.touch], seed: n.midi });
    }
  };
  const bufferFor = (n: NoteSound): AudioBuffer => {
    const key = soundKey(n);
    let b = buffers.get(key);
    if (!b) buffers.set(key, (b = toBuffer(render(n))));
    return b;
  };
  /**
   * Before playing from `fromSec`: the notes of its first PREPARE_SEC. Then the
   * rest in slices of SLICE_MS, in the order they're heard from there, so they're
   * ready before the scheduler reaches them (it makes any it meets first itself).
   */
  let filling: ReturnType<typeof setTimeout> | null = null;
  const prepareSynth = (fromSec: number) => {
    const order = a.events.map((_, i) => i).filter((i) => eventSec[i] >= fromSec);
    for (const i of order) if (eventSec[i] < fromSec + PREPARE_SEC) bufferFor(sounds[i]);
    // Then the notes before the start point (loops and seeks come back to them).
    const rest = [...order, ...a.events.map((_, i) => i).filter((i) => eventSec[i] < fromSec)];
    let next = 0;
    const slice = () => {
      filling = null;
      const until = performance.now() + SLICE_MS;
      while (next < rest.length && performance.now() < until) bufferFor(sounds[rest[next++]]);
      if (next < rest.length) filling = setTimeout(slice, 0);
    };
    if (filling) clearTimeout(filling);
    filling = setTimeout(slice, 0);
  };

  const stretched = new Map<number, Promise<AudioBuffer>>();
  const originalAt = (ratio: number): Promise<AudioBuffer> | null => {
    if (!original) return null;
    if (ratio === 1) return Promise.resolve(original);
    let p = stretched.get(ratio);
    if (!p) {
      const channels = Array.from({ length: original.numberOfChannels }, (_, c) => original.getChannelData(c));
      p = timeStretchAsync(channels, original.sampleRate, ratio).then((outs) => {
        const b = ctx.createBuffer(outs.length, outs[0].length, original.sampleRate);
        outs.forEach((o, c) => b.copyToChannel(o as Float32Array<ArrayBuffer>, c));
        return b;
      });
      stretched.set(ratio, p);
    }
    return p;
  };
  const ready = new Map<number, AudioBuffer>();
  const ensureOriginal = async (ratio: number) => {
    const p = originalAt(ratio);
    if (p) ready.set(ratio, await p);
  };

  let state: PlayerState = 'idle';
  const setState = (s: PlayerState) => {
    if (s === state) return;
    state = s;
    onStateChange?.(s);
  };

  let ratio = 1;
  let mix: Mix = original ? 'both' : 'sheet';
  let originalLevel = DEFAULT_ORIGINAL_LEVEL;
  let loop: { startSec: number; endSec: number } | null = null;
  let scheduler: Scheduler | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let cancelFrame: (() => void) | null = null;
  let endAt: number | null = null;
  let queue: Array<{ eventIndex: number; when: number }> = [];
  const active = new Set<AudioBufferSourceNode>();
  const passSources = new Map<number, AudioBufferSourceNode>();
  const ringing: Array<{ src: AudioBufferSourceNode; gain: GainNode } | undefined> = [];

  const applyMix = () => {
    const now = ctx.currentTime;
    const [sheet, orig] = !original ? [1, 0] : mix === 'sheet' ? [1, 0] : mix === 'original' ? [0, 1] : [1, originalLevel ** 2];
    sheetBus.gain.setTargetAtTime(sheet, now, MIX_GLIDE_SEC);
    originalBus.gain.setTargetAtTime(orig, now, MIX_GLIDE_SEC);
  };
  applyMix();

  /** What the listener hears now, on the context clock. */
  const audibleTime = () => {
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      const age = performance.now() - ts.performanceTime;
      if (age > -TIMESTAMP_MAX_AHEAD_MS && age < TIMESTAMP_MAX_AGE_MS) return ts.contextTime + age / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  };

  const playSource = (buffer: AudioBuffer, bus: AudioNode, when: number, gainValue: number, offset = 0) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(gain);
    gain.connect(bus);
    src.onended = () => active.delete(src);
    src.start(when, offset);
    active.add(src);
    return { src, gain };
  };

  const tick = () => {
    if (!scheduler) return;
    const now = ctx.currentTime;
    const r = scheduler.advance(now + LOOKAHEAD_SEC);

    for (const { id, audioEnd } of r.passesEnded) {
      passSources.get(id)?.stop(audioEnd);
      passSources.delete(id);
    }
    for (const p of r.passesStarted) {
      const buffer = ready.get(p.ratio);
      if (!buffer) continue;
      const late = Math.max(0, now - p.audioStart);
      const { src } = playSource(buffer, originalBus, p.audioStart + late, 1, p.songStart / p.ratio + late / p.ratio);
      passSources.set(p.id, src);
    }
    for (const { eventIndex, when } of r.notes) {
      const e = a.events[eventIndex];
      // A person's timing and touch (scaled with speed, so a slow practice tempo isn't sloppier).
      const at = Math.max(ctx.currentTime, when + (strum.get(eventIndex) ?? 0) + human[eventIndex].offsetSec / ratio);
      const touch = human[eventIndex].gain;
      // The note's written length on the audio clock (song seconds run 1/ratio as fast at other speeds).
      const held = (timeline.tickToSec(e.tick + e.dur) - eventSec[eventIndex]) / ratio;
      const sound = sounds[eventIndex];
      const buffer = bufferFor(sound);
      const damp = (s: number) => {
        const prev = ringing[s];
        if (!prev) return;
        prev.gain.gain.setTargetAtTime(0, at, DAMP_SEC);
        prev.src.stop(at + DAMP_SEC * 8);
        ringing[s] = undefined;
      };
      if (!('midi' in sound)) {
        // Apagado: the hand lands on every string and stops the strum.
        if (sound.kind === 'apagado') ringing.forEach((_, s) => damp(s));
        if (buffer) playSource(buffer, stringBus[e.string], at, noteGain(e) * touch);
      } else if (buffer) {
        damp(e.string);
        // Legato: no new pluck — the finger lands on the ringing string, so skip the attack.
        const legato = sound.kind === 'legato';
        const gain = noteGain(e) * touch;
        const voice = playSource(buffer, stringBus[e.string], at, legato ? 0 : gain, legato ? LEGATO_SKIP_SEC : 0);
        if (legato) voice.gain.gain.setTargetAtTime(gain, at, LEGATO_RISE_SEC);

        if (e.melody && held > VIBRATO_MIN_SEC && typeof ctx.createOscillator === 'function' && voice.src.detune) {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = VIBRATO_HZ;
          depth.gain.setValueAtTime(0, at + VIBRATO_DELAY_SEC);
          depth.gain.linearRampToValueAtTime(VIBRATO_CENTS, at + VIBRATO_DELAY_SEC + 0.3);
          lfo.connect(depth);
          depth.connect(voice.src.detune);
          lfo.start(at + VIBRATO_DELAY_SEC);
          lfo.stop(at + held + 0.5);
        }
        // Crisp moods stop pattern notes at their written length; the tune always rings.
        if (feel.crisp && !e.melody) voice.gain.gain.setTargetAtTime(0, at + held, CRISP_RELEASE_SEC);
        ringing[e.string] = voice;
      }
      queue.push({ eventIndex, when });
      onScheduled?.(eventIndex, when);
    }
    if (r.endedAt !== null) endAt = r.endedAt;
  };

  const frame = () => {
    const heard = audibleTime();
    let last: number | null = null;
    while (queue.length && queue[0].when <= heard) last = (queue.shift() as { eventIndex: number }).eventIndex;
    if (last !== null) onCursor(last);
    if (endAt !== null && heard >= endAt) {
      finish();
      onEnd?.();
      return;
    }
    cancelFrame = nextFrame(frame);
  };

  const finish = () => {
    if (timer) clearInterval(timer);
    timer = null;
    cancelFrame?.();
    cancelFrame = null;
    scheduler = null;
    queue = [];
    endAt = null;
    setState('idle');
  };

  const stop = () => {
    const now = ctx.currentTime;
    for (const src of active) {
      try {
        src.stop(now);
      } catch {
        // already stopped
      }
    }
    active.clear();
    passSources.clear();
    ringing.length = 0;
    finish();
  };

  const barTicks = a.meter.beatsPerBar * TICKS_PER_BEAT;
  const playFrom = async (fromTick: number) => {
    if (state !== 'idle') stop();
    setState('preparing');
    await ctx.resume();
    const at = Math.max(0, Math.min(fromTick, a.bars * barTicks));
    prepareSynth(timeline.tickToSec(at));
    await ensureOriginal(ratio);
    if (state !== 'preparing') return; // stopped while preparing
    scheduler = createScheduler({ eventSec, endSec: timeline.endSec });
    scheduler.setLoop(loop);
    scheduler.start(ctx.currentTime + START_DELAY_SEC, timeline.tickToSec(at), ratio);
    setState('playing');
    tick();
    timer = setInterval(tick, TICK_MS);
    cancelFrame = nextFrame(frame);
  };

  return {
    get state() {
      return state;
    },
    get tempoRatio() {
      return ratio;
    },
    play: (fromBar = 0) => playFrom(fromBar * barTicks),
    playFrom,
    stop,
    async setTempoRatio(next) {
      const r = Math.min(1, Math.max(MIN_RATIO, next));
      if (r === ratio) return;
      await ensureOriginal(r);
      ratio = r;
      scheduler?.setRatio(r);
    },
    setLoop(barStart, barEnd = barStart ?? 0) {
      loop = barStart === null ? null : { startSec: timeline.barToSec(barStart), endSec: timeline.barToSec(barEnd + 1) };
      scheduler?.setLoop(loop);
    },
    setMix(next) {
      mix = next;
      applyMix();
    },
    setOriginalLevel(level) {
      originalLevel = Math.min(1, Math.max(0, level));
      applyMix();
    },
    dispose() {
      stop();
      if (filling) clearTimeout(filling);
      sheetBus.disconnect();
      originalBus.disconnect();
      master.disconnect();
      if (ownsContext) void ctx.close();
    },
  };
}
