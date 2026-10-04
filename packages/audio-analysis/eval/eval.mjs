// nx run audio-analysis:eval — tempo, meter and chord accuracy on fixtures.
// Reads fixtures/audio (real, licensed clips) and fixtures/synthetic (generated).
// Each clip: <name>.wav + <name>.chords.json { bpm, beatsPerBar, chords: [{ start, chord }] }.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSamples } from '../dist/index.js';

const ROOT = new URL('../../../', import.meta.url).pathname;
const DIRS = ['fixtures/audio', 'fixtures/synthetic'];
const TEMPO_TOLERANCE = 3;
const require = createRequire(import.meta.url);
const { EssentiaWASM, Essentia } = require('essentia.js');
const essentia = new Essentia(EssentiaWASM);

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FAMILY = { maj: 'maj', 7: 'maj', maj7: 'maj', 6: 'maj', add9: 'maj', m: 'min', m7: 'min', sus2: 'sus', sus4: 'sus', dim: 'dim' };
const SUFFIX = { '': 'maj', m: 'm', 7: '7', m7: 'm7', maj7: 'maj7', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', dim: 'dim', add9: 'add9', 6: '6' };

function parse(name) {
  const m = /^([A-G])([#b]?)([^/]*)/.exec(name);
  if (!m) return null;
  const pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { pc, quality: SUFFIX[m[3]] ?? 'maj' };
}

/** 16-bit PCM or 32-bit float WAV → mono Float32 at 44.1 kHz (linear resample). */
function readWav(path) {
  const b = readFileSync(path);
  let pos = 12;
  let fmt;
  let data;
  while (pos < b.length - 8) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(pos + 8), channels: b.readUInt16LE(pos + 10), rate: b.readUInt32LE(pos + 12), bits: b.readUInt16LE(pos + 22) };
    if (id === 'data') data = b.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path}: not a WAV file`);
  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let v = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const o = (i * fmt.channels + c) * bytes;
      v += fmt.format === 3 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : data.readInt32LE(o) / 2147483648;
    }
    mono[i] = v / fmt.channels;
  }
  if (fmt.rate === 44100) return mono;
  const out = new Float32Array(Math.floor((frames * 44100) / fmt.rate));
  for (let i = 0; i < out.length; i++) {
    const x = (i * fmt.rate) / 44100;
    const k = Math.floor(x);
    out[i] = mono[k] + (x - k) * ((mono[k + 1] ?? mono[k]) - mono[k]);
  }
  return out;
}

const chordAtTime = (list, t) => {
  let found = null;
  for (const c of list) if (c.start <= t + 1e-6) found = c;
  return found;
};

async function evaluate(dir, name) {
  const truth = JSON.parse(readFileSync(join(ROOT, dir, `${name}.chords.json`), 'utf8'));
  const samples = readWav(join(ROOT, dir, `${name}.wav`));
  const t0 = performance.now();
  const r = await analyzeSamples(samples, 44100, { essentia });
  const ms = performance.now() - t0;

  const bpb = r.meter.beatsPerBar;
  const est = r.chords.map((c) => ({ start: r.beatTimesSec[r.barStartBeat + c.bar * bpb + c.beat] ?? Infinity, chord: c.chord }));
  const truthChords = truth.chords.map((c) => ({ start: c.start, chord: parse(c.chord) }));
  const from = truthChords[0].start;
  const to = truth.beatTimesSec ? truth.beatTimesSec.at(-1) : samples.length / 44100 - 1;
  let n = 0;
  const hit = { root: 0, majmin: 0, exact: 0 };
  for (let t = from + 0.05; t < to; t += 0.1) {
    const want = chordAtTime(truthChords, t)?.chord;
    const got = chordAtTime(est, t)?.chord;
    if (!want) continue;
    n++;
    if (!got) continue;
    if (got.pc === want.pc) {
      hit.root++;
      if (FAMILY[got.quality] === FAMILY[want.quality]) hit.majmin++;
      if (got.quality === want.quality) hit.exact++;
    }
  }
  return {
    name,
    source: dir.endsWith('synthetic') ? 'synthetic' : 'real',
    kind: truth.kind ?? '',
    bpmTrue: truth.bpm,
    bpmEst: r.bpm,
    tempoOk: Math.abs(r.bpm - truth.bpm) <= TEMPO_TOLERANCE,
    meterOk: !truth.beatsPerBar || truth.beatsPerBar === bpb,
    root: hit.root / n,
    majmin: hit.majmin / n,
    exact: hit.exact / n,
    seconds: samples.length / 44100,
    ms,
  };
}

const clips = DIRS.flatMap((dir) =>
  existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir))
        .filter((f) => f.endsWith('.wav') && existsSync(join(ROOT, dir, f.replace(/\.wav$/, '.chords.json'))))
        .map((f) => [dir, f.replace(/\.wav$/, '')])
    : [],
);
if (!clips.length) {
  console.log('No fixtures. Run: node tools/make-synthetic-fixtures.mjs');
  process.exit(1);
}

const rows = [];
for (const [dir, name] of clips) rows.push(await evaluate(dir, name));

const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(5);
console.log(`\n${'clip'.padEnd(18)}${'kind'.padEnd(18)}${'bpm'.padStart(12)}  meter  root majmin exact   time`);
for (const r of rows) {
  const bpm = `${r.bpmTrue}→${r.bpmEst}`;
  console.log(
    `${r.name.padEnd(18)}${r.kind.padEnd(18)}${bpm.padStart(12)}${r.tempoOk ? ' ' : '!'} ${r.meterOk ? '  ok ' : ' MISS'}${pct(r.root)}${pct(r.majmin)}${pct(r.exact)} ${(r.ms / 1000).toFixed(1).padStart(5)}s`,
  );
}
const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
const tempoRate = rows.filter((r) => r.tempoOk).length / rows.length;
const speed = rows.reduce((s, r) => s + r.ms / 1000, 0) / rows.reduce((s, r) => s + r.seconds, 0);
console.log(`\n${rows.length} clips (${rows.filter((r) => r.source === 'real').length} real, ${rows.filter((r) => r.source === 'synthetic').length} synthetic)`);
console.log(`tempo within ±${TEMPO_TOLERANCE} BPM: ${pct(tempoRate)} (target 90%) ${tempoRate >= 0.9 ? 'PASS' : 'FAIL'}`);
console.log(`meter: ${pct(rows.filter((r) => r.meterOk).length / rows.length)}`);
console.log(`chords: root ${pct(mean('root'))}, major/minor ${pct(mean('majmin'))}, exact ${pct(mean('exact'))}`);
console.log(`speed: ${(speed * 180).toFixed(1)} s per 3-minute clip (Node, this machine)`);

const out = join(ROOT, 'packages/audio-analysis/test-output');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'eval.json'), JSON.stringify({ rows, tempoRate, speed }, null, 2));
