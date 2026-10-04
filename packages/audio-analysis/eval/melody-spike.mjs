// Melody spike (PLAN M9): can essentia's melody tracker make a song recognisable?
// For each clip in fixtures/audio and fixtures/local: extract the predominant melody
// (PredominantPitchMelodia → PitchContourSegmentation), then render, with the app's
// nylon synth, into fixtures/local/melody-spike/ (git-ignored):
//   <name>.melody.wav            the melody alone
//   <name>.melody+original.wav   the melody over the original at low volume (to judge timing and pitch)
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
  const { shift, notes: placed } = toGuitarRange(notes);
  const melody = render(placed, signal.length);
  const mix = new Float32Array(signal.length);
  for (let i = 0; i < mix.length; i++) mix[i] = melody[i] * 0.8 + signal[i] * 0.25;
  writeWav(join(OUT, `${name}.melody.wav`), melody);
  writeWav(join(OUT, `${name}.melody+original.wav`), mix);
  const secs = signal.length / SR;
  console.log(
    `${name}\n  ${secs.toFixed(0)} s, ${notes.length} notes (${(notes.length / secs).toFixed(1)}/s), voiced ${(voiced * 100).toFixed(0)}% of frames, ` +
      `octave shift ${shift >= 0 ? '+' : ''}${shift}, analysis ${(ms / 1000).toFixed(1)} s`,
  );
}
console.log(`\nWrote ${OUT}`);
