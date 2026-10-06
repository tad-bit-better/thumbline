// App icons (favicon, Apple touch icon) built from the logo, like make-lottie.mjs: the
// geometry comes from the mark's geometry module and the icon recipe, the colours from tokens.css,
// so a change to the logo is a code review, not a file swap.
//   node tools/make-icons.mjs
// Writes apps/web/src/app/icon.svg, apps/web/src/app/apple-icon.png and apps/web/public/favicon.ico.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Colours: the tokens, by name.
const tokens = read('packages/ui/src/styles/tokens.css');
const token = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(tokens);
  if (!m) throw new Error(`No --${name} in tokens.css`);
  return m[1];
};

// Geometry: the pick path from the icon recipe, the rest from the mark's own geometry module
// (TypeScript without type-only syntax, which Node runs directly).
const recipe = read('packages/ui/src/icons3d/recipe.tsx');
const PICK_PATH = /PICK_PATH = '([^']+)'/.exec(recipe)[1];
const { FRETS, PICK_TRANSFORM, RIDGE_WIDTH, STRINGS_REGION, ridges } = await import('../packages/ui/src/components/Logo/geometry.ts');

/**
 * The mark as a standalone SVG: the Tile recipe (rounded rect + gloss band) without the
 * ground shadow, which an app icon can't afford. `full` bleeds the tile to the square
 * (app icons get their own mask); `detail` as LogoMark (small: fewer ridges, no numbers).
 */
function markSvg({ full = false, detail = 'full' } = {}) {
  const surface = token('color-surface');
  const ridge = token('color-orange-soft');
  const tile = full ? '<rect width="64" height="64" fill="url(#t)"/>' : '<rect x="6" y="5" width="52" height="51" rx="15" fill="url(#t)"/>';
  const gloss = full ? `<rect x="6" y="5" width="52" height="16" rx="8" fill="${surface}" opacity="0.1"/>` : `<rect x="10" y="8" width="44" height="15" rx="8" fill="${surface}" opacity="0.2"/>`;
  const r = STRINGS_REGION;
  const frets =
    detail === 'full'
      ? FRETS.map(({ x, y, text }) => `<rect x="${x - 2.1}" y="${y - 2.6}" width="4.2" height="5.2" rx="1.2" fill="url(#t)"/><text x="${x}" y="${y + 1.7}" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, Menlo, monospace" font-weight="600" font-size="4.8" fill="${ridge}">${text}</text>`).join('')
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${token('color-violet-soft')}"/><stop offset="0.3" stop-color="${token('color-violet')}"/><stop offset="1" stop-color="${token('color-violet-deep')}"/></linearGradient>
<radialGradient id="p" cx="0.35" cy="0.28" r="0.8"><stop offset="0" stop-color="${token('color-orange-soft')}"/><stop offset="0.35" stop-color="${token('color-orange')}"/><stop offset="1" stop-color="${token('color-orange-deep')}"/></radialGradient>
<clipPath id="c"><path d="${PICK_PATH}" transform="${PICK_TRANSFORM}"/><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/></clipPath>
</defs>
${tile}
${gloss}
<path d="${PICK_PATH}" transform="${PICK_TRANSFORM}" fill="url(#p)" stroke="${ridge}" stroke-opacity="0.9" stroke-width="1.4" stroke-linejoin="round"/>
<g clip-path="url(#c)" fill="none" stroke="${ridge}" stroke-width="${RIDGE_WIDTH[detail]}" stroke-linecap="round" stroke-linejoin="round">${ridges(detail).map((d) => `<path d="${d}"/>`).join('')}</g>
${frets}
</svg>
`;
}

// Raster sizes through Chromium (Playwright is already a dev dependency for the e2e tests).
const require = createRequire(join(ROOT, 'apps/web-e2e/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** An .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

// The tab icon shows at 16–32px: the small detail. The home-screen icon is big: the full mark.
const tab = markSvg({ detail: 'small' });
writeFileSync(join(ROOT, 'apps/web/src/app/icon.svg'), tab);
writeFileSync(join(ROOT, 'apps/web/src/app/apple-icon.png'), await png(markSvg({ full: true }), 180));
const sizes = [16, 32, 48];
writeFileSync(join(ROOT, 'apps/web/public/favicon.ico'), ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(tab, size) })))));
await browser.close();
console.log('Wrote icon.svg, apple-icon.png and favicon.ico');
