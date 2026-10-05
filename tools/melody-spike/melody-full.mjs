// Melody spike v3 (PLAN M9): what a chord-melody sheet would sound like.
// For each clip: analyse it (the app's pipeline), arrange it with the engine's real
// patterns, put the cleaned melody on top, and render offline with the app's synth plus
// groove (small human timing, loudness that follows the song), a guitar body, stereo and
// vibrato on held notes. Writes fixtures/local/melody-spike/<name>.full.<style>-<level>.m4a.
// With --app: render what the app itself produces (the engine places the tune; M9), as
// <name>.app.<style>-<level>.m4a, instead of the spike's own melody overlay.
// Run after building: pnpm nx run-many -t build -p @thumbline/engine @thumbline/playback @thumbline/audio-analysis
//   node tools/melody-spike/melody-full.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync, readdirSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';
import { arrange } from '../../packages/engine/dist/index.js';
import {
  apagadoChunk,
  feelOf,
  humanize,
  createTimeline,
  golpeBurst,
  harmonicTone,
  noteGain,
  nylonPluck,
  slapBurst,
  soundOf,
  strumOffsets,
} from '../../packages/playback/dist/index.js';
import { analyzeSamples } from '../../packages/audio-analysis/dist/index.js';
import { OUT, ROOT, SR, beatsAndKey, clean, e, melodyOf, onePerBeat, room } from './melody-spike.mjs';

const APP = process.argv.includes('--app') || process.argv.includes('--moods');
// --moods: the app's Fingerstyle Moderate in each of the four moods (M10), to hear the vibe change.
const MOODS = process.argv.includes('--moods');
const RENDERS = [
  ['fingerstyle', 'basic'],
  ['fingerstyle', 'moderate'],
  ['fingerstyle', 'advanced'],
  ['arpeggio', 'moderate'],
  ['flamenco', 'moderate'],
];

function readStereoWav(path) {
  const b = readFileSync(path);
  let pos = 12;
  while (pos < b.length - 8) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'data') {
      const n = Math.floor(size / 4);
      const l = new Float32Array(n);
      const r = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        l[i] = b.readInt16LE(pos + 8 + i * 4) / 32768;
        r[i] = b.readInt16LE(pos + 10 + i * 4) / 32768;
      }
      return [l, r];
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

function writeStereoWav(path, l, r) {
  const n = l.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 4, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 4, 40);
  const q = (v) => Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(q(l[i]), 44 + i * 4);
    b.writeInt16LE(q(r[i]), 46 + i * 4);
  }
  writeFileSync(path, b);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ peaking EQ, in place. */
function peak(x, hz, db, q) {
  const A = 10 ** (db / 40);
  const w = (2 * Math.PI * hz) / SR;
  const al = Math.sin(w) / (2 * q);
  const [b0, b1, b2, a0, a1, a2] = [1 + al * A, -2 * Math.cos(w), 1 - al * A, 1 + al / A, -2 * Math.cos(w), 1 - al / A];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x[i], y1, y];
    x[i] = y;
  }
}

/** Loudness of the original per half second, mapped to 0.55–1, smoothed: the arrangement breathes with the song. */
function dynamics(mono) {
  const win = SR / 2;
  const db = [];
  for (let i = 0; i < mono.length; i += win) {
    let s = 0;
    const end = Math.min(mono.length, i + win);
    for (let j = i; j < end; j++) s += mono[j] * mono[j];
    db.push(10 * Math.log10(s / Math.max(1, end - i) + 1e-9));
  }
  const sorted = [...db].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.1)];
  const hi = sorted[Math.floor(sorted.length * 0.95)];
  const g = db.map((d) => 0.55 + 0.45 * Math.min(1, Math.max(0, (d - lo) / (hi - lo || 1))));
  const smooth = g.map((_, i) => (g[Math.max(0, i - 1)] + 2 * g[i] + g[Math.min(g.length - 1, i + 1)]) / 4);
  return (sample) => {
    const p = sample / win;
    const i = Math.min(smooth.length - 1, Math.floor(p));
    const f = p - i;
    return smooth[i] * (1 - f) + (smooth[Math.min(smooth.length - 1, i + 1)] ?? smooth[i]) * f;
  };
}

/** Mix a buffer into the stereo bus with pan, gain, a fade-out at `end`, and an optional vibrato read. */
function mixVoice(bus, buf, { start, end, gain, pan = 0, skip = 0, rise = 1, vibrato = false }) {
  const [L, R] = bus;
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  const fade = Math.floor(0.03 * SR);
  const stop = Math.min(L.length, end ?? start + buf.length - skip);
  let pos = skip;
  for (let i = start; i < stop + fade && i < L.length; i++) {
    const k = i - start;
    const p = Math.floor(pos);
    if (p + 1 >= buf.length) break;
    const v = buf[p] + (buf[p + 1] - buf[p]) * (pos - p);
    const env = Math.min(1, k / rise) * (i >= stop ? 1 - (i - stop) / fade : 1);
    L[i] += v * gl * env;
    R[i] += v * gr * env;
    // Vibrato on held notes: after 0.25 s, ±0.15 semitone at 5.5 Hz.
    const t = k / SR;
    pos += vibrato && t > 0.25 ? 2 ** ((0.15 * Math.min(1, (t - 0.25) / 0.3) * Math.sin(2 * Math.PI * 5.5 * t)) / 12) : 1;
  }
}

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

function renderFull(analysis, line, mono, capo0) {
  const length = mono.length;
  const bus = [new Float32Array(length), new Float32Array(length)];
  const loud = dynamics(mono);
  const rand = rng(11);
  const fn = ({ style, level, mood }) => {
    const a = arrange(analysis, { style, level, ...(mood ? { mood } : {}) });
    const tl = createTimeline(a, { beatTimesSec: analysis.beatTimesSec, barStartBeat: analysis.barStartBeat });
    const feel = a.feel ? feelOf(a.feel) : { strumMs: 12, reverb: 0.22, shelfDb: 0, crisp: false };
    const strum = strumOffsets(a.events, feel.strumMs);
    const human = humanize(a.events, a.meter.beatsPerBar);
    bus[0].fill(0);
    bus[1].fill(0);

    // Where the melody sits: a few semitones above the pattern's treble.
    const treble = a.events.filter((n) => n.fret >= 0 && n.finger !== 'p').map((n) => OPEN_MIDI[n.string] + a.capo + n.fret).sort((x, y) => x - y);
    const top = treble[Math.floor(treble.length * 0.75)] ?? 67;
    const mids = line.map((n) => n.midi).sort((x, y) => x - y);
    const med = mids[Math.floor(mids.length / 2)] ?? 69;
    const shift = 12 * Math.round((top + 5 - med) / 12);
    const tune = APP ? [] : line.map((n) => ({ ...n, midi: Math.min(86, Math.max(55, n.midi + shift)) }));
    const melodyAt = (sec) => tune.find((n) => n.t <= sec && sec < n.t + n.dur);

    // Accompaniment: voices per string, each stops when the next note on that string starts.
    const cache = new Map();
    const bufOf = (s) => {
      const key = 'midi' in s ? `${s.kind}:${s.midi}` : s.kind;
      if (!cache.has(key)) {
        cache.set(
          key,
          s.kind === 'golpe' ? golpeBurst(SR) : s.kind === 'slap' ? slapBurst(SR) : s.kind === 'apagado' ? apagadoChunk(SR)
            : s.kind === 'harmonic' ? harmonicTone(s.midi, SR) : s.kind === 'muted' ? nylonPluck(s.midi, SR, { muted: true }) : nylonPluck(s.midi, SR),
        );
      }
      return cache.get(key);
    };
    const voices = [];
    const ringing = [];
    a.events.forEach((n, i) => {
      const sec = tl.tickToSec(n.tick) + (strum.get(i) ?? 0) + (APP ? human[i].offsetSec : (rand() - 0.5) * 0.012);
      const start = Math.max(0, Math.floor(sec * SR));
      const s = soundOf(n, a.capo);
      if (!('midi' in s)) {
        if (s.kind === 'apagado') ringing.forEach((v, k) => v && ((v.end = start), (ringing[k] = undefined)));
        voices.push({ buf: bufOf(s), start, gain: noteGain(n) * 0.6, pan: 0 });
        return;
      }
      // Leave the tune room: no pattern note at or just under a melody note that's sounding.
      const m = melodyAt(sec);
      if (n.finger !== 'p' && m && s.midi >= m.midi - 2) return;
      if (ringing[n.string]) ringing[n.string].end = start;
      const held = tl.tickToSec(n.tick + n.dur) - sec;
      const v = {
        buf: bufOf(s),
        start,
        // Crisp moods stop pattern notes at their written length.
        ...(feel.crisp && !n.melody ? { end: start + Math.floor(held * SR) } : {}),
        gain: noteGain(n) * 0.55 * (APP ? human[i].gain : 1),
        pan: n.melody ? 0.08 : (n.string - 2.5) * 0.1,
        skip: s.kind === 'legato' ? Math.floor(0.02 * SR) : 0,
        rise: s.kind === 'legato' ? Math.floor(0.006 * SR) : 1,
        vibrato: n.melody === true && held > 0.45,
      };
      ringing[n.string] = v;
      voices.push(v);
    });
    for (const v of voices) mixVoice(bus, v.buf, v);

    // Melody: legato on small steps, accents on the beat, vibrato on held notes.
    const mcache = new Map();
    tune.forEach((n, i) => {
      if (!mcache.has(n.midi)) mcache.set(n.midi, nylonPluck(n.midi, SR, { seconds: 3 }));
      const prev = tune[i - 1];
      const legato = prev && Math.abs(n.midi - prev.midi) <= 2 && n.t - (prev.t + prev.dur) < 0.06;
      const start = Math.max(0, Math.floor((n.t + (rand() - 0.5) * 0.016) * SR));
      mixVoice(bus, mcache.get(n.midi), {
        start,
        end: start + Math.floor(n.dur * SR),
        gain: (n.beat ? 0.78 : n.eighth ? 0.68 : 0.6) * (legato ? 0.85 : 1),
        pan: 0.08,
        skip: legato ? Math.floor(0.02 * SR) : 0,
        rise: legato ? Math.floor(0.006 * SR) : 1,
        vibrato: n.dur > 0.45,
      });
    });

    // Guitar body, the song's dynamics, a room, then normalise.
    for (const ch of bus) {
      peak(ch, 105, 5, 2);
      peak(ch, 230, 2.5, 1.4);
      peak(ch, 5200, -3, 0.8);
      peak(ch, 4500, feel.shelfDb, 0.5); // the mood's colour (a broad bell standing in for the app's high shelf)
      for (let i = 0; i < ch.length; i++) ch[i] *= loud(i);
    }
    const wet = feel.reverb * 1.4;
    const out = [room(bus[0], wet), room(bus[1].map((v, i) => (i > 300 ? bus[1][i - 300] * 0.15 + v : v)), wet)];
    let max = 0;
    for (const ch of out) for (const v of ch) max = Math.max(max, Math.abs(v));
    for (const ch of out) for (let i = 0; i < ch.length; i++) ch[i] *= 0.89 / (max || 1);
    fn.tuneCount = a.events.filter((n) => n.melody).length;
    return { pattern: a.patternId, capo: a.capo, out, arranged: a };
  };
  return fn;
}

// --only <text>: just the clips whose name contains it (repeatable).
const ONLY = process.argv.flatMap((a, i) => (a === '--only' ? [process.argv[i + 1]] : []));
const clips = ['fixtures/audio', 'fixtures/local']
  .flatMap((d) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).map((f) => join(ROOT, d, f)) : []))
  .filter((f) => /\.(mp3|m4a|wav|aac|flac)$/i.test(f))
  .filter((f) => !ONLY.length || ONLY.some((o) => f.includes(o)));

for (const clip of clips) {
  const name = parsePath(clip).name;
  const wav = join(OUT, `${name}.stereo.wav`);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '2', clip, wav]);
  const [l, r] = readStereoWav(wav);
  rmSync(wav);
  const mono = l.map((v, i) => (v + r[i]) / 2);
  const side = l.map((v, i) => (v - r[i]) / 2);
  console.log(name);
  const analysis = await analyzeSamples(mono, SR, { essentia: e, side });
  console.log(`  ${analysis.bpm.toFixed(0)} bpm, ${analysis.meter.beatsPerBar}/4, ${analysis.chords.length} chord segments, ${analysis.melody?.length ?? 0} melody notes`);
  const { notes } = melodyOf(mono);
  const { beats, scale } = beatsAndKey(mono);
  const line = clean(notes, beats, scale, mono.length / SR);
  const basicLine = onePerBeat(line, beats);
  if (analysis.mood) console.log(`  mood: energy ${analysis.mood.energy}, valence ${analysis.mood.valence}`);
  const jobs = MOODS ? ['melancholic', 'warm', 'intense', 'upbeat'].map((mood) => ['fingerstyle', 'moderate', mood]) : RENDERS;
  for (const [style, level, mood] of jobs) {
    if (style === 'flamenco' && analysis.meter.beatsPerBar !== 4) continue;
    const render = renderFull(analysis, level === 'basic' ? basicLine : line, mono);
    const { pattern, capo, out, arranged } = render({ style, level, mood });
    const tmp = join(OUT, `${name}.full.tmp.wav`);
    const m4a = join(OUT, `${name}.${MOODS ? `mood-${mood}` : `${APP ? 'app' : 'full'}.${style}-${level}`}.m4a`);
    writeStereoWav(tmp, out[0], out[1]);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '192000', tmp, m4a]);
    rmSync(tmp);
    console.log(`  ${style} ${level}${mood ? ` ${mood}` : ''}: ${pattern}, capo ${capo}${APP ? `, ${render.tuneCount} tune notes` : ''}${arranged.sections ? `, sections ${['soft', 'normal', 'full'].map((l) => `${l} ${arranged.sections.filter((x) => x === l).length}`).join('/')}` : ''}`);
  }
}
console.log(`\nWrote ${OUT}`);
