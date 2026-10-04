// The "try a sample clip" song on the Upload screen (also the e2e fixture).
// Rendered with our own synth, so it carries no third-party rights.
// Usage: node tools/make-sample-clip.mjs && afconvert -f m4af -d aac -b 96000 <wav> apps/web/public/samples/sample.m4a
import { writeFileSync } from 'node:fs';
import { render, wav } from './make-synthetic-fixtures.mjs';

const song = { name: 'sample', kind: 'guitar and bass', chart: 'G Em C D', style: 'fingerstyle', level: 'moderate', bpm: 92, bass: true };
const { wav: data, truth } = render(song, 7, 8);
const out = process.argv[2] ?? 'sample.wav';
writeFileSync(out, data);
writeFileSync(out.replace(/\.wav$/, '.chords.json'), JSON.stringify(truth, null, 2) + '\n');
console.log(`${out}: ${(data.length / 1e6).toFixed(1)} MB`);
