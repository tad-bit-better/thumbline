// Mood probe (PLAN M10): the cheap mood signals essentia gives us, per clip, to calibrate thresholds.
// Run: node tools/melody-spike/mood-probe.mjs  (reads fixtures/local/melody-spike/*.source.wav from the melody spike)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, SR, beatsAndKey, e, readMonoWav } from './melody-spike.mjs';

for (const f of readdirSync(OUT).filter((f) => f.endsWith('.source.wav'))) {
  const x = readMonoWav(join(OUT, f));
  const v = e.arrayToVector(x);
  const onsets = e.OnsetRate(v).onsetRate;
  const dance = e.Danceability(v).danceability;
  const dyn = e.DynamicComplexity(v).dynamicComplexity;
  let centroid = 0;
  let frames = 0;
  for (let i = 0; i + 2048 < x.length; i += 2048 * 8) {
    const w = e.Windowing(e.arrayToVector(x.subarray(i, i + 2048)), true, 2048, 'hann');
    const sp = e.Spectrum(w.frame, 2048);
    centroid += e.Centroid(sp.spectrum, SR / 2).centroid;
    frames++;
  }
  const { beats, key } = beatsAndKey(x);
  const bpm = 60 / ((beats.at(-1) - beats[0]) / (beats.length - 1));
  console.log(`${f.replace('.source.wav', '')}\n  ${key}, ${bpm.toFixed(0)} bpm, onsets ${onsets.toFixed(2)}/s, danceability ${dance.toFixed(2)}, dynamic complexity ${dyn.toFixed(2)} dB, brightness ${(centroid / frames).toFixed(0)} Hz`);
}
