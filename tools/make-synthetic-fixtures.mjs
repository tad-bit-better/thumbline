// Renders licence-clean test songs with known tempo and chords for the
// audio-analysis eval (PLAN §7, synthetic until real clips are added).
// Deterministic: same output every run. Writes fixtures/synthetic/*.wav + *.chords.json.
// Needs built engine and playback: pnpm nx run-many -t build -p @thumbline/engine @thumbline/playback
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arrange, parseChord } from '../packages/engine/dist/index.js';
import { midiOf, noteGain, nylonPluck } from '../packages/playback/dist/index.js';

const SR = 44100;
const OUT = new URL('../fixtures/synthetic/', import.meta.url).pathname;
const DEFAULT_BARS = 16;

export const SONGS = [
  { name: 'pop-g-nylon', kind: 'solo nylon', chart: 'G D Em C', style: 'arpeggio', level: 'basic', bpm: 84 },
  { name: 'ballad-c-nylon', kind: 'solo nylon', chart: 'C G/B Am Am/G F C/E Dm7 G', style: 'arpeggio', level: 'moderate', bpm: 72 },
  { name: 'waltz-d-nylon', kind: 'solo nylon', chart: 'D D G A7 D Bm Em7 A7', style: 'arpeggio', level: 'moderate', bpm: 108, meter: 3 },
  { name: 'minor-am-bass', kind: 'guitar and bass', chart: 'Am F C G Am Dm E7 Am', style: 'fingerstyle', level: 'moderate', bpm: 96, bass: true },
  { name: 'folk-e-steel', kind: 'solo steel', chart: 'E A B7 E C#m A B7 E', style: 'fingerstyle', level: 'basic', bpm: 120, steel: true },
  { name: 'pop-c-band', kind: 'full band', chart: 'C G Am F', style: 'fingerstyle', level: 'moderate', bpm: 112, bass: true, drums: true },
  { name: 'rock-d-band', kind: 'full band', chart: 'D A Bm G', style: 'arpeggio', level: 'basic', bpm: 132, bass: true, drums: true, noise: true, steel: true },
  { name: 'voice-g', kind: 'voice and guitar', chart: 'G Em C D', style: 'fingerstyle', level: 'basic', bpm: 90, voice: true },
  { name: 'jazzy-c', kind: 'solo nylon', chart: 'Dm7 G7 Cmaj7 Am7', style: 'arpeggio', level: 'advanced', bpm: 100 },
  { name: 'sus-d', kind: 'solo steel', chart: 'Dsus4 D Asus4 A', style: 'fingerstyle', level: 'moderate', bpm: 104, steel: true },
  { name: 'rumba-am', kind: 'rumba', chart: 'Am G F E', style: 'arpeggio', level: 'basic', bpm: 128, claps: true, bass: true },
  { name: 'tangos-am', kind: 'tangos', chart: 'Am G F E7', style: 'fingerstyle', level: 'moderate', bpm: 116, claps: true },
  { name: 'ballad-g-34', kind: 'voice and guitar', chart: 'G Em C D', style: 'fingerstyle', level: 'moderate', bpm: 66, meter: 3, voice: true },
  { name: 'fast-a-band', kind: 'full band', chart: 'A E F#m D', style: 'fingerstyle', level: 'advanced', bpm: 150, bass: true, drums: true },
  { name: 'flats-bb-voice', kind: 'voice and band', chart: 'Bb F Gm Eb', style: 'arpeggio', level: 'moderate', bpm: 92, bass: true, voice: true, drums: true },
];

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function render(song, seed, BARS = DEFAULT_BARS) {
  const rand = random(seed);
  const bpb = song.meter ?? 4;
  const tokens = song.chart.split(' ');
  const bars = Array.from({ length: BARS }, (_, i) => tokens[i % tokens.length]);
  // A human-ish beat grid: slow tempo drift (±3%) plus ±8 ms jitter.
  const beatTimes = [];
  let t = 0.3 + rand() * 0.4;
  const phase = rand() * 6;
  for (let b = 0; b <= BARS * bpb + 2; b++) {
    beatTimes.push(t + (rand() - 0.5) * 0.016);
    t += (60 / song.bpm) * (1 + 0.03 * Math.sin(phase + b / 19));
  }
  const tickToSec = (tick) => {
    const b = tick / 480;
    const i = Math.min(beatTimes.length - 2, Math.floor(b));
    return beatTimes[i] + (b - i) * (beatTimes[i + 1] - beatTimes[i]);
  };
  const chords = bars.map((name, bar) => ({ bar, beat: 0, chord: parseChord(name).label, confidence: 1, alternatives: [] }));
  const a = arrange(
    { version: 1, durationSec: t, bpm: song.bpm, beatTimesSec: beatTimes, barStartBeat: 0, meter: { beatsPerBar: bpb }, key: { pc: 0, mode: 'major' }, chords },
    { style: song.style, level: song.level },
  );

  const end = beatTimes[BARS * bpb] + 2.5;
  const mix = new Float32Array(Math.ceil(end * SR));
  const add = (buf, at, gain, length = buf.length) => {
    const start = Math.floor(at * SR);
    for (let i = 0; i < length && start + i < mix.length; i++) mix[start + i] += buf[i] * gain;
  };

  // Guitar, one sound per string at a time.
  const plucks = new Map();
  const pluck = (midi) => {
    if (!plucks.has(midi)) {
      let x = nylonPluck(midi, SR, { seed: midi * 7 + seed });
      if (song.steel) {
        const y = new Float32Array(x.length);
        for (let i = 1; i < x.length; i++) y[i] = x[i] + 0.8 * (x[i] - x[i - 1]) * 4;
        x = y;
      }
      plucks.set(midi, x);
    }
    return plucks.get(midi);
  };
  const nextOnString = new Map();
  for (let i = a.events.length - 1; i >= 0; i--) {
    const e = a.events[i];
    const at = tickToSec(e.tick);
    if (e.fret < 0) continue;
    const buf = pluck(midiOf(e.string, e.fret, a.capo));
    const until = nextOnString.get(e.string);
    const length = until === undefined ? buf.length : Math.min(buf.length, Math.floor((until - at + 0.01) * SR));
    add(buf, at, noteGain(e) * (song.steel ? 0.6 : 1), Math.max(0, length));
    nextOnString.set(e.string, at);
  }

  const tone = (hz, seconds, decay, harmonics = [1]) => {
    const n = Math.floor(seconds * SR);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      harmonics.forEach((h, k) => (v += h * Math.sin((2 * Math.PI * hz * (k + 1) * i) / SR)));
      x[i] = v * Math.exp(-i / SR / decay) * Math.min(1, i / (SR * 0.004));
    }
    return x;
  };
  const noise = (seconds, decay, smooth = 0) => {
    const n = Math.floor(seconds * SR);
    const x = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const r = rand() * 2 - 1;
      lp = smooth * lp + (1 - smooth) * r;
      x[i] = (smooth ? lp : r) * Math.exp(-i / SR / decay);
    }
    return x;
  };
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  const marks = a.chordMarks;
  const chordAt = (tick) => [...marks].reverse().find((m) => m.tick <= tick);

  for (let bar = 0; bar < BARS; bar++) {
    const mark = chordAt(bar * bpb * 480);
    const label = parseChord(mark.soundingName).label;
    for (let beat = 0; beat < bpb; beat++) {
      const at = beatTimes[bar * bpb + beat];
      const beatLen = beatTimes[bar * bpb + beat + 1] - at;
      if (song.bass && (beat === 0 || (bpb === 4 && beat === 2))) {
        add(tone(hz(36 + ((label.pc - 0 + 12) % 12)), beatLen * 1.8, 0.5, [1, 0.35, 0.12]), at, 0.35);
      }
      if (song.drums) {
        const strong = beat === 0 || (bpb === 4 && beat === 2);
        if (strong) add(tone(55, 0.25, 0.08, [1, 0.3]), at, 0.6);
        else add(noise(0.18, 0.05), at, 0.22);
        add(noise(0.05, 0.012), at, 0.08);
        add(noise(0.05, 0.012), at + beatLen / 2, 0.06);
      }
      if (song.claps && beat % 2 === 1) add(noise(0.12, 0.025, 0.3), at, 0.25);
      if (song.voice) {
        const tones = [0, 4, 7].map((iv) => (label.quality === 'm' || label.quality === 'm7') && iv === 4 ? 3 : iv);
        const midi = 60 + ((label.pc + tones[(bar + beat) % 3]) % 12);
        const n = Math.floor(beatLen * 0.95 * SR);
        const v = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
          const f = hz(midi) * (1 + 0.006 * Math.sin((2 * Math.PI * 5.5 * i) / SR));
          ph += (2 * Math.PI * f) / SR;
          const env = Math.min(1, i / (SR * 0.06)) * Math.min(1, (n - i) / (SR * 0.08));
          v[i] = (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph)) * env;
        }
        add(v, at, 0.12);
      }
    }
  }
  if (song.noise) {
    for (let i = 0; i < mix.length; i++) mix[i] += (rand() * 2 - 1) * 0.004;
  }

  let peak = 0;
  for (const v of mix) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < mix.length; i++) mix[i] *= 0.9 / peak;

  const truth = {
    name: song.name,
    kind: song.kind,
    synthetic: true,
    bpm: song.bpm,
    beatsPerBar: bpb,
    beatTimesSec: beatTimes.slice(0, BARS * bpb + 1).map((x) => +x.toFixed(4)),
    chords: marks.map((m) => ({ start: +tickToSec(m.tick).toFixed(4), chord: m.soundingName })),
  };
  return { wav: wav(mix), truth };
}

export function wav(x) {
  const buf = Buffer.alloc(44 + x.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + x.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return buf;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(OUT, { recursive: true });
  const force = process.argv.includes('--force');
  SONGS.forEach((song, i) => {
    const wavPath = join(OUT, `${song.name}.wav`);
    if (!force && existsSync(wavPath)) return;
    const { wav: data, truth } = render(song, 1000 + i);
    writeFileSync(wavPath, data);
    writeFileSync(join(OUT, `${song.name}.chords.json`), JSON.stringify(truth, null, 2) + '\n');
    console.log(`${song.name}: ${(data.length / 1e6).toFixed(1)} MB, ${truth.chords.length} chord marks`);
  });
}
