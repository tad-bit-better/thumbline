// Melody spike (PLAN M9): can essentia's melody tracker make a song recognisable?
// For each clip in fixtures/audio and fixtures/local: extract the predominant melody
// (PredominantPitchMelodia → PitchContourSegmentation), then render, with the app's
// nylon synth, into fixtures/local/melody-spike/ (git-ignored):
//   <name>.melody.wav            the melody alone
//   <name>.melody+original.wav   the melody over the original at low volume (to judge timing and pitch)
//   <name>.clean.wav             cleaned: short blips dropped, octave slips fixed, split notes merged,
//                                stray out-of-key notes snapped, onsets on the 16th grid; played with
//                                legato, accents on the beat and a little room
//   <name>.clean+original.wav    the cleaned line over the original
//   <name>.basic.wav             one note per beat (what a Basic sheet would carry)
// and print how many notes were found. Run: node packages/audio-analysis/eval/melody-spike.mjs
// Needs macOS afconvert to decode mp3/m4a. Everything stays on this machine.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';
import { nylonPluck } from '../../playback/dist/index.js';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = join(ROOT, 'fixtures/local/melody-spike');
const SR = 44100;
const require = createRequire(import.meta.url);
const { EssentiaWASM, Essentia } = require('essentia.js');
const e = new Essentia(EssentiaWASM);

/** 16-bit mono WAV at 44.1 kHz, as written by afconvert below. */
function readMonoWav(path) {
  const b = readFileSync(path);
  let pos = 12;
  while (pos < b.length - 8) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'data') {
      const n = Math.floor(size / 2);
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = b.readInt16LE(pos + 8 + i * 2) / 32768;
      return x;
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

function writeWav(path, x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(path, b);
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function beatsAndKey(signal) {
  const v = e.arrayToVector(signal);
  const beats = [...e.vectorToArray(e.RhythmExtractor2013(v, 208, 'degara', 40).ticks)];
  const k = e.KeyExtractor(v);
  const pc = NAMES.indexOf(k.key);
  const steps = k.scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return { beats, key: `${k.key} ${k.scale}`, scale: new Set(steps.map((x) => (pc + x) % 12)) };
}

function melodyOf(signal) {
  const eq = e.EqualLoudness(e.arrayToVector(signal));
  const { pitch, pitchConfidence } = e.PredominantPitchMelodia(eq.signal);
  const seg = e.PitchContourSegmentation(pitch, e.arrayToVector(signal));
  const onset = e.vectorToArray(seg.onset);
  const duration = e.vectorToArray(seg.duration);
  const midi = e.vectorToArray(seg.MIDIpitch);
  const conf = e.vectorToArray(pitchConfidence);
  const voiced = e.vectorToArray(pitch).filter((p) => p > 0).length / conf.length;
  return { notes: [...onset].map((t, i) => ({ t, dur: duration[i], midi: Math.round(midi[i]) })), voiced };
}

/** Seconds of the 16th-note grid, following the beat times (tempo drift included). */
function grid16(beats, end) {
  const out = [];
  const step = beats.length > 1 ? (beats.at(-1) - beats[0]) / (beats.length - 1) : 0.5;
  const all = [...beats];
  while (all.at(-1) < end) all.push(all.at(-1) + step);
  for (let b = 0; b < all.length - 1; b++) for (let k = 0; k < 4; k++) out.push({ t: all[b] + ((all[b + 1] - all[b]) * k) / 4, beat: k === 0, eighth: k % 2 === 0 });
  return out;
}

/**
 * Clean the tracker's notes into a playable line:
 * 1. drop blips under 90 ms; 2. fix octave slips (a note 9+ semitones from its
 * neighbours' median moves an octave toward them); 3. merge a held note the
 * tracker split (same pitch, gap under 120 ms); 4. snap short out-of-key notes
 * to the nearest key note; 5. move onsets to the nearest 16th, one note per slot
 * (the longer wins); 6. each note lasts until the next one, up to a beat and a
 * half, so the line sings instead of ticking.
 */
function clean(notes, beats, scale, end) {
  let n = notes.filter((x) => x.dur >= 0.09).map((x) => ({ ...x }));
  for (let i = 0; i < n.length; i++) {
    const around = n.slice(Math.max(0, i - 3), i).concat(n.slice(i + 1, i + 4)).map((x) => x.midi).sort((a, b) => a - b);
    if (!around.length) continue;
    const med = around[Math.floor(around.length / 2)];
    while (n[i].midi - med >= 9) n[i].midi -= 12;
    while (med - n[i].midi >= 9) n[i].midi += 12;
  }
  const merged = [];
  for (const x of n) {
    const last = merged.at(-1);
    if (last && last.midi === x.midi && x.t - (last.t + last.dur) < 0.12) last.dur = x.t + x.dur - last.t;
    else merged.push(x);
  }
  for (const x of merged) {
    if (scale.has(((x.midi % 12) + 12) % 12) || x.dur > 0.35) continue;
    x.midi += scale.has((((x.midi - 1) % 12) + 12) % 12) ? -1 : 1;
  }
  const g = grid16(beats, end);
  const slots = new Map();
  for (const x of merged) {
    let best = 0;
    for (let j = 1; j < g.length; j++) if (Math.abs(g[j].t - x.t) < Math.abs(g[best].t - x.t)) best = j;
      else if (g[j].t > x.t) break;
    const prev = slots.get(best);
    if (!prev || x.dur > prev.dur) slots.set(best, { ...x, slot: best, t: g[best].t, beat: g[best].beat, eighth: g[best].eighth });
  }
  const line = [...slots.values()].sort((a, b) => a.t - b.t);
  const beat = beats.length > 1 ? (beats.at(-1) - beats[0]) / (beats.length - 1) : 0.5;
  line.forEach((x, i) => {
    const next = line[i + 1]?.t ?? x.t + x.dur;
    x.dur = Math.min(next - x.t, Math.max(x.dur, 0) + 0.25 * beat, 1.5 * beat);
  });
  return line;
}

/**
 * Basic: on each beat, the note sounding there (or starting within the next
 * 16th), held until the next beat's note; a repeat of the same pitch ties over.
 */
function onePerBeat(line, beats) {
  const out = [];
  const sixteenth = beats.length > 1 ? (beats.at(-1) - beats[0]) / (beats.length - 1) / 4 : 0.12;
  for (const b of beats) {
    const x = line.find((n) => n.t <= b + sixteenth * 0.5 && n.t + n.dur > b) ?? line.find((n) => n.t > b && n.t < b + sixteenth * 1.5);
    if (!x) continue;
    const last = out.at(-1);
    if (last && last.midi === x.midi && last.src === x) continue;
    out.push({ ...x, t: b, beat: true, eighth: true, src: x });
  }
  out.forEach((x, i) => (x.dur = Math.min((out[i + 1]?.t ?? x.t + x.dur) - x.t, x.src.t + x.src.dur - x.t + sixteenth * 4)));
  return out;
}

/** A small room: a few feedback-comb filters into an allpass (Schroeder), mixed low. */
function room(x, mix = 0.18) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d), i: 0, fb: 0.78 }));
  const ap = { buf: new Float32Array(225), i: 0 };
  const out = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let wet = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.buf[c.i] = x[n] + y * c.fb;
      c.i = (c.i + 1) % c.buf.length;
      wet += y;
    }
    const a = ap.buf[ap.i];
    const y = -0.5 * wet + a;
    ap.buf[ap.i] = wet + 0.5 * y;
    ap.i = (ap.i + 1) % ap.buf.length;
    out[n] = x[n] + mix * 0.25 * y;
  }
  return out;
}

/**
 * Sing it on a guitar: notes ring into the next one (a short crossfade, not a
 * cut); a step of up to 2 semitones within 60 ms is played legato (no new pluck,
 * like a hammer-on or pull-off); notes on the beat are a little louder, short
 * off-beat notes softer.
 */
function renderSung(line, length) {
  const out = new Float32Array(length);
  const cache = new Map();
  const tone = (m) => {
    if (!cache.has(m)) cache.set(m, nylonPluck(m, SR, { seconds: 3 }));
    return cache.get(m);
  };
  line.forEach((x, i) => {
    const prev = line[i - 1];
    const legato = prev && Math.abs(x.midi - prev.midi) <= 2 && x.t - (prev.t + prev.dur) < 0.06;
    const gain = (x.beat ? 0.62 : x.eighth ? 0.52 : 0.44) * (x.dur < 0.15 ? 0.85 : 1);
    const t = tone(x.midi);
    const skip = legato ? Math.floor(0.02 * SR) : 0;
    const start = Math.floor(x.t * SR);
    const fade = Math.floor(0.03 * SR);
    const ring = Math.min(t.length - skip, Math.floor(x.dur * SR) + fade);
    const rise = legato ? Math.floor(0.006 * SR) : 1;
    for (let k = 0; k < ring && start + k < length; k++) {
      const env = Math.min(1, k / rise) * (k > ring - fade ? (ring - k) / fade : 1);
      out[start + k] += t[skip + k] * gain * env;
    }
  });
  return room(out);
}

/** Shift by octaves so the line sits on the guitar's top strings (median near A4). */
function toGuitarRange(notes) {
  const sorted = notes.map((n) => n.midi).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 69;
  const shift = 12 * Math.round((69 - median) / 12);
  return { shift, notes: notes.map((n) => ({ ...n, midi: Math.min(84, Math.max(52, n.midi + shift)) })) };
}

function render(notes, length) {
  const out = new Float32Array(length);
  const cache = new Map();
  for (const n of notes) {
    if (!cache.has(n.midi)) cache.set(n.midi, nylonPluck(n.midi, SR, { seconds: 2.5 }));
    const tone = cache.get(n.midi);
    const start = Math.floor(n.t * SR);
    // Let it ring for the note plus a little, then damp, like a fretting hand releasing.
    const ring = Math.min(tone.length, Math.floor((n.dur + 0.15) * SR));
    for (let i = 0; i < ring && start + i < length; i++) {
      const release = i > ring - 600 ? (ring - i) / 600 : 1;
      out[start + i] += tone[i] * 0.6 * release;
    }
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const clips = ['fixtures/audio', 'fixtures/local']
  .flatMap((d) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).map((f) => join(ROOT, d, f)) : []))
  .filter((f) => /\.(mp3|m4a|wav|aac|flac)$/i.test(f));

for (const clip of clips) {
  const name = parsePath(clip).name;
  const wav = join(OUT, `${name}.source.wav`);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', clip, wav]);
  const signal = readMonoWav(wav);
  const t0 = Date.now();
  const { notes, voiced } = melodyOf(signal);
  const ms = Date.now() - t0;
  const { beats, key, scale } = beatsAndKey(signal);
  const { shift, notes: placed } = toGuitarRange(notes);
  const secs0 = signal.length / SR;
  const line = clean(placed, beats, scale, secs0);
  const basic = onePerBeat(line, beats);
  const sung = renderSung(line, signal.length);
  const mixClean = new Float32Array(signal.length);
  for (let i = 0; i < mixClean.length; i++) mixClean[i] = sung[i] * 0.8 + signal[i] * 0.25;
  writeWav(join(OUT, `${name}.clean.wav`), sung);
  writeWav(join(OUT, `${name}.clean+original.wav`), mixClean);
  writeWav(join(OUT, `${name}.basic.wav`), renderSung(basic, signal.length));
  const melody = render(placed, signal.length);
  const mix = new Float32Array(signal.length);
  for (let i = 0; i < mix.length; i++) mix[i] = melody[i] * 0.8 + signal[i] * 0.25;
  writeWav(join(OUT, `${name}.melody.wav`), melody);
  writeWav(join(OUT, `${name}.melody+original.wav`), mix);
  const secs = signal.length / SR;
  console.log(
    `${name}\n  ${secs.toFixed(0)} s, ${notes.length} notes (${(notes.length / secs).toFixed(1)}/s), voiced ${(voiced * 100).toFixed(0)}% of frames, ` +
      `octave shift ${shift >= 0 ? '+' : ''}${shift}, analysis ${(ms / 1000).toFixed(1)} s\n` +
      `  key ${key}, ${beats.length} beats; cleaned ${line.length} notes (${(line.length / secs).toFixed(1)}/s), ` +
      `${(100 * line.filter((x) => scale.has(((x.midi % 12) + 12) % 12)).length / line.length).toFixed(0)}% in key; basic ${basic.length} notes`,
  );
}
console.log(`\nWrote ${OUT}`);
