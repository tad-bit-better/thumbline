import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { LOTTIE } from '../src/lib/lottie';

const PUBLIC = join(import.meta.dirname, '../public');

/** The files in a .lottie (zip), by name. */
function unzip(buf: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const extra = buf.readUInt16LE(at + 28);
    const name = buf.toString('utf8', at + 30, at + 30 + nameLen);
    const start = at + 30 + nameLen + extra;
    files.set(name, inflateRawSync(buf.subarray(start, start + size)).toString('utf8'));
    at = start + size;
  }
  return files;
}

// docs/design/motion.md: the moments, their length and whether they loop.
const MOMENTS = [
  ['pickDrop', 700, false],
  ['metronome', 2000, true], // one swing per beat at 60 bpm
  ['chordConfirmed', 450, false],
  ['firstPlay', 1200, false],
] as const;

describe('dotLottie moments', () => {
  it.each(MOMENTS)('%s is a valid .lottie under 60 KB, %i ms long', (key, ms, loop) => {
    const buf = readFileSync(join(PUBLIC, LOTTIE[key]));
    expect(buf.length).toBeLessThan(60 * 1024);
    const files = unzip(buf);
    const manifest = JSON.parse(files.get('manifest.json') ?? '{}');
    const [entry] = manifest.animations;
    expect(entry.loop).toBe(loop);
    const json = JSON.parse(files.get(`animations/${entry.id}.json`) ?? '{}');
    expect(json.fr).toBe(60);
    expect(Math.round(((json.op - json.ip) / json.fr) * 1000)).toBe(ms);
  });

  it('serves the renderer from our origin, matching the installed player', () => {
    // Regenerate with `node tools/make-lottie.mjs` after upgrading @lottiefiles/dotlottie-react.
    const fromUi = createRequire(join(import.meta.dirname, '../../../packages/ui/package.json'));
    const fromReact = createRequire(fromUi.resolve('@lottiefiles/dotlottie-react'));
    const installed = fromReact.resolve('@lottiefiles/dotlottie-web').replace(/[^/]+$/, 'dotlottie-player.wasm');
    expect(readFileSync(join(PUBLIC, LOTTIE.wasm)).equals(readFileSync(installed))).toBe(true);
  });
});
