import type { Arrangement } from '@thumbline/engine';
import { type Scheduler, createScheduler } from './scheduler.js';
import { timeStretchAsync } from './stretch.js';
import { type NoteSound, apagadoChunk, golpeBurst, harmonicTone, noteGain, nylonPluck, roomImpulse, slapBurst, soundOf, strumOffsets } from './synth.js';
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
  dispose: () => void;
  readonly state: PlayerState;
  readonly tempoRatio: number;
};

const LOOKAHEAD_SEC = 0.15;
const TICK_MS = 25;
const START_DELAY_SEC = 0.06;
/** How fast a string is damped when the next note on it starts. */
const DAMP_SEC = 0.012;
/** A hammer-on or pull-off starts past the pluck's noisy attack and swells in. */
const LEGATO_SKIP_SEC = 0.02;
const LEGATO_RISE_SEC = 0.004;
/** How much of the sheet goes to the room reverb (the original has its own room). */
const REVERB_SEND = 0.22;
/** Stereo spread of the strings: low E this far left, high E as far right. */
const STRING_PAN = 0.25;
const ORIGINAL_LEVEL_BOTH = 0.8;
const MIX_GLIDE_SEC = 0.02;
const MIN_RATIO = 0.5;

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

  const master = ctx.createGain();
  const sheetBus = ctx.createGain();
  const originalBus = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  master.gain.value = 0.9;
  sheetBus.connect(master);
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
    send.gain.value = REVERB_SEND;
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
  const strum = strumOffsets(a.events);

  const sounds = a.events.map((e) => soundOf(e, a.capo));
  const buffers = new Map<string, AudioBuffer>();
  const soundKey = (n: NoteSound) => ('midi' in n ? `${n.kind === 'legato' ? 'pluck' : n.kind}:${n.midi}` : n.kind);
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
        return harmonicTone(n.midi, sr);
      case 'muted':
        return nylonPluck(n.midi, sr, { muted: true });
      case 'pluck':
      case 'legato':
        return nylonPluck(n.midi, sr);
    }
  };
  const prepareSynth = () => {
    for (const n of sounds) {
      const key = soundKey(n);
      if (!buffers.has(key)) buffers.set(key, toBuffer(render(n)));
    }
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
    const [sheet, orig] = !original ? [1, 0] : mix === 'sheet' ? [1, 0] : mix === 'original' ? [0, 1] : [1, ORIGINAL_LEVEL_BOTH];
    sheetBus.gain.setTargetAtTime(sheet, now, MIX_GLIDE_SEC);
    originalBus.gain.setTargetAtTime(orig, now, MIX_GLIDE_SEC);
  };
  applyMix();

  /** What the listener hears now, on the context clock. */
  const audibleTime = () => {
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
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
      const at = when + (strum.get(eventIndex) ?? 0);
      const sound = sounds[eventIndex];
      const buffer = buffers.get(soundKey(sound));
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
        if (buffer) playSource(buffer, stringBus[e.string], at, noteGain(e));
      } else if (buffer) {
        damp(e.string);
        // Legato: no new pluck — the finger lands on the ringing string, so skip the attack.
        const legato = sound.kind === 'legato';
        const voice = playSource(buffer, stringBus[e.string], at, legato ? 0 : noteGain(e), legato ? LEGATO_SKIP_SEC : 0);
        if (legato) voice.gain.gain.setTargetAtTime(noteGain(e), at, LEGATO_RISE_SEC);
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
    prepareSynth();
    await ensureOriginal(ratio);
    if (state !== 'preparing') return; // stopped while preparing
    scheduler = createScheduler({ eventSec, endSec: timeline.endSec });
    scheduler.setLoop(loop);
    const at = Math.max(0, Math.min(fromTick, a.bars * barTicks));
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
    dispose() {
      stop();
      sheetBus.disconnect();
      originalBus.disconnect();
      master.disconnect();
      if (ownsContext) void ctx.close();
    },
  };
}
