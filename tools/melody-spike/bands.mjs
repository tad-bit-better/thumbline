// Where a recording's energy sits (PLAN M10b, sound depth): the share under 80 Hz, at 80–250 Hz
// (a guitar's body and bass strings; solo recordings 21–41%), at 250–2500 Hz and above.
//   node tools/melody-spike/bands.mjs <audio file>...
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const SR = 44100;
const N = 4096;
const EDGES = [80, 250, 2500];

function readMonoWav(path) {
  const b = readFileSync(path);
  let pos = 12;
  while (pos < b.length - 8) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'data') {
      const x = new Float32Array(Math.floor(size / 2));
      for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(pos + 8 + i * 2) / 32768;
      return x;
    }
    pos += 8 + size + (size & 1);
  }
  throw new Error(`no data chunk in ${path}`);
}

/** In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

function bands(x) {
  const power = new Float64Array(N / 2);
  const win = Float64Array.from({ length: N }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N));
  for (let start = 0; start + N <= x.length; start += N / 2) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let n = 0; n < N; n++) re[n] = x[start + n] * win[n];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
  }
  const total = power.reduce((s, v) => s + v, 0) || 1;
  const shares = [0, ...EDGES, SR / 2].slice(0, -1).map((lo, i) => {
    const hi = [...EDGES, SR / 2][i];
    let s = 0;
    for (let k = 1; k < N / 2; k++) {
      const hz = (k * SR) / N;
      if (hz >= lo && hz < hi) s += power[k];
    }
    return s / total;
  });
  return shares;
}

console.log(`${'file'.padEnd(60)} <80 Hz  80–250  250–2500  >2500`);
for (const file of process.argv.slice(2)) {
  const tmp = join(tmpdir(), `bands.${process.pid}.wav`);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', file, tmp]);
  const x = readMonoWav(tmp);
  rmSync(tmp);
  const pct = bands(x).map((v) => `${(v * 100).toFixed(0)}%`.padStart(6));
  console.log(`${basename(file).slice(0, 58).padEnd(60)}${pct.join('   ')}`);
}
