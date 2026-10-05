// Reference probe (PLAN M9/M10): what makes real fingerstyle recordings sound connected, and how
// our renders compare. For each reference clip in fixtures/audio and each of our renders in
// fixtures/local/melody-spike (*.app.* and *.mood-*), print:
//   mood        the app's own detection (energy, valence → label), bpm, key
//   ring        median dB a note has faded by the time the next onset arrives (low = notes ring into each other)
//   attack var  spread (dB, std) of onset peak levels (high = varied touch; ~0 = machine-like)
//   timing      median distance (ms) of onsets from the nearest 16th of the beat grid (human push and pull)
//   bright      mean spectral centroid, Hz
//   dynamics    loudness range across the piece, p90 − p10 of half-second RMS, dB
// Everything is decoded and measured on this machine. Run after building the packages:
//   node tools/melody-spike/reference-probe.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSamples } from '../../packages/audio-analysis/dist/index.js';
import { moodLabelOf } from '../../packages/engine/dist/index.js';
import { OUT, ROOT, SR, e, readMonoWav } from './melody-spike.mjs';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const std = (xs) => {
  const m = xs.reduce((a, x) => a + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
};
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];

function envelopeDb(x, frame = Math.floor(SR * 0.01)) {
  const out = new Float32Array(Math.floor(x.length / frame));
  for (let f = 0; f < out.length; f++) {
    let s = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) s += x[i] * x[i];
    out[f] = 10 * Math.log10(s / frame + 1e-10);
  }
  return out;
}

async function probe(path, label) {
  const tmp = join(OUT, `probe.${process.pid}.tmp.wav`);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', path, tmp]);
  const x = readMonoWav(tmp);
  rmSync(tmp);
  const a = await analyzeSamples(x, SR, { essentia: e });
  const v = e.arrayToVector(x);
  const onsets = [...e.vectorToArray(e.OnsetRate(v).onsets)];
  const env = envelopeDb(x);
  const at = (sec) => env[Math.min(env.length - 1, Math.max(0, Math.round(sec * 100)))];
  const peakAfter = (t) => Math.max(...[0, 1, 2, 3, 4, 5].map((k) => at(t + k * 0.01)));
  const drops = [];
  const peaks = [];
  for (let i = 0; i + 1 < onsets.length; i++) {
    const t = onsets[i];
    const next = onsets[i + 1];
    if (next - t < 0.08) continue;
    const peak = peakAfter(t);
    peaks.push(peak);
    drops.push(peak - (at(next - 0.03) + at(next - 0.02)) / 2);
  }
  // Timing against the 16th grid, from the app's own beat times.
  const bt = a.beatTimesSec;
  const grid = [];
  for (let b = 0; b + 1 < bt.length; b++) for (let k = 0; k < 4; k++) grid.push(bt[b] + ((bt[b + 1] - bt[b]) * k) / 4);
  const offs = onsets.map((t) => {
    let best = Infinity;
    for (const g of grid) best = Math.min(best, Math.abs(g - t));
    return best * 1000;
  });
  let centroid = 0;
  let n = 0;
  for (let i = 0; i + 2048 < x.length; i += SR / 2) {
    const w = e.Windowing(e.arrayToVector(x.subarray(i, i + 2048)), true, 2048, 'hann');
    const c = e.Centroid(e.Spectrum(w.frame, 2048).spectrum, SR / 2).centroid;
    if (Number.isFinite(c) && c > 0) {
      centroid += c;
      n++;
    }
  }
  const half = [];
  for (let f = 0; f + 50 <= env.length; f += 50) half.push(10 * Math.log10(env.slice(f, f + 50).reduce((s, d) => s + 10 ** (d / 10), 0) / 50));
  const loud = half.filter((d) => d > pct(half, 0.05));
  const mood = a.mood ? `${moodLabelOf(a.mood).padEnd(11)} e ${a.mood.energy.toFixed(2)} v ${a.mood.valence.toFixed(2)}` : 'no mood';
  console.log(
    `${label.slice(0, 44).padEnd(44)} | ${mood} | ${String(Math.round(a.bpm)).padStart(3)} bpm ${(NAMES[a.key.pc] + ' ' + a.key.mode).padEnd(8)} | ring ${median(drops).toFixed(1).padStart(5)} dB | attack var ${std(peaks).toFixed(1).padStart(4)} dB | timing ${median(offs).toFixed(0).padStart(3)} ms | bright ${(centroid / n).toFixed(0).padStart(4)} Hz | dynamics ${(pct(loud, 0.9) - pct(loud, 0.1)).toFixed(1).padStart(4)} dB`,
  );
}

// One process per clip: essentia's WASM heap doesn't shrink, and a few long songs fill it.
if (process.argv[2]) {
  await probe(process.argv[2], process.argv[3] ?? process.argv[2]);
} else {
  const self = fileURLToPath(import.meta.url);
  const run = (path, label) => process.stdout.write(execFileSync(process.execPath, [self, path, label], { maxBuffer: 1 << 26 }).toString().split('\n').filter((l) => l.includes(' | ')).join('\n') + '\n');
  const refs = readdirSync(join(ROOT, 'fixtures/audio')).filter((f) => /\.(mp3|m4a|wav|flac)$/i.test(f));
  const ours = existsSync(OUT) ? readdirSync(OUT).filter((f) => /\.(app\.fingerstyle-(moderate|advanced)|mood-melancholic)\.m4a$/.test(f)) : [];
  console.log('— reference recordings (fixtures/audio)');
  for (const f of refs) run(join(ROOT, 'fixtures/audio', f), f.replace(/\.(mp3|m4a)$/i, ''));
  console.log('— our renders (fixtures/local/melody-spike)');
  for (const f of ours) run(join(OUT, f), f.replace(/\.m4a$/, ''));
}
