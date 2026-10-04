// Builds the signature dotLottie moments (docs/design/motion.md) from code:
// geometry and colours come from the 3D icons and tokens, timings from motion.md.
// Deterministic; no dependencies. Writes apps/web/public/lottie/*.lottie, plus the
// player's WASM so it's served from our origin, not a CDN (apps/web/specs/lottie-assets.spec.ts checks it).
// #2 (listening loop) stays in CSS: the Listening screen's 28-bar wave already is it.
// Usage: node tools/make-lottie.mjs
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';

const OUT = new URL('../apps/web/public/lottie/', import.meta.url).pathname;
const FPS = 60;
const MAX_BYTES = 60 * 1024;

// Brand colours (packages/ui/src/styles/tokens.css).
const C = {
  surface: '#FFFFFF',
  ink: '#1E1A33',
  violet: '#5B3BF5',
  violetDeep: '#3F23C9',
  violetSoft: '#EDE9FF',
  orange: '#FF7A3D',
  orangeDeep: '#C73C08',
  orangeSoft: '#FFF1E8',
  mint: '#14A386',
  mintDeep: '#0C6E5A',
  mintSoft: '#D8F7EF',
  rose: '#FF5C8A',
};
// Geometry shared with packages/ui/src/icons3d.
const PICK_PATH = 'M32 9C44 9 51 14 51 22C51 33 41 46 32 54C23 46 13 33 13 22C13 14 20 9 32 9Z';
const METRONOME_BODY = 'M13 54L25 10Q32 3 39 10L51 54Z';
const METRONOME_FACE = 'M21 47L28 16H36L43 47Z';

// ---------- Lottie building blocks ----------

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const fixed = (k) => ({ a: 0, k });
const EASE = {
  inOut: { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
  in: { o: { x: [0.5], y: [0] }, i: { x: [0.9], y: [0.6] } },
  out: { o: { x: [0.1], y: [0.4] }, i: { x: [0.5], y: [1] } },
  linear: { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
};
/** Keyframes: [[frame, value, easeToNext?], ...]; values are numbers or arrays. */
const anim = (frames) => ({
  a: 1,
  k: frames.map(([t, v, ease = 'inOut'], n) => {
    const s = Array.isArray(v) ? v : [v];
    return n === frames.length - 1 ? { t, s } : { t, s, ...EASE[ease] };
  }),
});
const val = (v) => (v && typeof v === 'object' && 'a' in v ? v : fixed(v));

const fill = (hex, opacity = 100) => ({ ty: 'fl', c: fixed([...rgb(hex), 1]), o: val(opacity), r: 1, bm: 0 });
const stroke = (hex, width, opacity = 100) => ({ ty: 'st', c: fixed([...rgb(hex), 1]), o: val(opacity), w: fixed(width), lc: 2, lj: 2, ml: 4, bm: 0 });
/** Radial gradient through soft → base → deep, lit from the top left (the icons' LitGradient). */
const litGradient = (tone, [cx, cy], radius) => ({
  ty: 'gf',
  t: 2,
  o: fixed(100),
  r: 1,
  bm: 0,
  s: fixed([cx, cy]),
  e: fixed([cx + radius, cy + radius * 0.4]),
  h: fixed(0),
  a: fixed(0),
  g: { p: 3, k: fixed([0, ...rgb(C[`${tone}Soft`]), 0.35, ...rgb(C[tone]), 1, ...rgb(C[`${tone}Deep`])]) },
});
const linearGradient = (stops, [x1, y1], [x2, y2]) => ({
  ty: 'gf',
  t: 1,
  o: fixed(100),
  r: 1,
  bm: 0,
  s: fixed([x1, y1]),
  e: fixed([x2, y2]),
  g: { p: stops.length, k: fixed(stops.flatMap(([at, hex]) => [at, ...rgb(hex)])) },
});
const ellipse = (cx, cy, w, h) => ({ ty: 'el', p: fixed([cx, cy]), s: fixed([w, h]), d: 1 });
const rect = (cx, cy, w, h, r) => ({ ty: 'rc', p: fixed([cx, cy]), s: fixed([w, h]), r: fixed(r), d: 1 });
const transform = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr',
  p: val(p),
  a: val(a),
  s: val(s),
  r: val(r),
  o: val(o),
  sk: fixed(0),
  sa: fixed(0),
});
const group = (nm, items, tr = {}) => ({ ty: 'gr', nm, it: [...items, transform(tr)] });

/** SVG path (absolute M, L, H, V, C, Q, Z) → Lottie bezier shape. */
function path(d) {
  const tokens = d.match(/[MLHVCQZ]|-?\d*\.?\d+/g);
  const v = [];
  const i = [];
  const o = [];
  let cur = [0, 0];
  let k = 0;
  const num = () => Number(tokens[k++]);
  const lineTo = (p) => {
    v.push(p);
    i.push([0, 0]);
    o.push([0, 0]);
    cur = p;
  };
  const cubicTo = (c1, c2, p) => {
    o[o.length - 1] = [c1[0] - cur[0], c1[1] - cur[1]];
    v.push(p);
    i.push([c2[0] - p[0], c2[1] - p[1]]);
    o.push([0, 0]);
    cur = p;
  };
  while (k < tokens.length) {
    const cmd = tokens[k++];
    if (cmd === 'M' || cmd === 'L') lineTo([num(), num()]);
    else if (cmd === 'H') lineTo([num(), cur[1]]);
    else if (cmd === 'V') lineTo([cur[0], num()]);
    else if (cmd === 'C') cubicTo([num(), num()], [num(), num()], [num(), num()]);
    else if (cmd === 'Q') {
      const q = [num(), num()];
      const p = [num(), num()];
      const c1 = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
      const c2 = [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
      cubicTo(c1, c2, p);
    }
  }
  // A closed path that ends where it started: fold the last vertex into the first.
  const [first, last] = [v[0], v[v.length - 1]];
  if (/Z\s*$/.test(d) && v.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) {
    i[0] = i[i.length - 1];
    v.pop();
    i.pop();
    o.pop();
  }
  // Closed only when the SVG says so: a tick or a rod is an open line.
  return { ty: 'sh', ks: fixed({ i, o, v, c: /Z\s*$/.test(d) }) };
}

function layer(ind, nm, shapes, { ks = {}, ip = 0, op } = {}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: val(ks.o ?? 100),
      r: val(ks.r ?? 0),
      p: val(ks.p ?? [0, 0, 0]),
      a: val(ks.a ?? [0, 0, 0]),
      s: val(ks.s ?? [100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  };
}

const animation = (nm, w, h, frames, layers) => ({
  v: '5.7.4',
  fr: FPS,
  ip: 0,
  op: frames,
  w,
  h,
  nm,
  ddd: 0,
  assets: [],
  layers: layers.map((l) => ({ ...l, op: frames })),
});

/** Seeded PRNG (mulberry32): the same burst every build. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- The moments ----------

/** #1 Pick drop, 700 ms: falls, squashes 1.18 × 0.82 on impact, rebounds, settles; the shadow grows. */
function pickDrop() {
  const F = 42;
  const tip = [32, 54];
  const pick = group(
    'pick',
    [
      group('specular', [ellipse(24, 18, 12, 6), fill(C.surface, 65)], { p: [24, 18], a: [24, 18], r: -20 }),
      group('rim', [path(PICK_PATH), stroke(C.surface, 1.5, 22)], { p: [32, 30], a: [32, 30], s: [78, 78] }),
      group('body', [path(PICK_PATH), litGradient('orange', [25, 17], 34)]),
    ],
    {
      a: tip,
      p: anim([[0, [32, 14], 'in'], [20, tip, 'out'], [29, [32, 48], 'in'], [36, tip, 'inOut'], [F, tip]]),
      s: anim([[0, [92, 108], 'in'], [20, [100, 100], 'out'], [24, [118, 82], 'inOut'], [30, [94, 106], 'inOut'], [36, [104, 96], 'inOut'], [F, [100, 100]]]),
      o: anim([[0, 0, 'out'], [6, 100, 'linear'], [F, 100]]),
    },
  );
  const shadow = group('shadow', [ellipse(32, 59, 26, 5.2), fill(C.orangeDeep, 28)], {
    p: [32, 59],
    a: [32, 59],
    s: anim([[0, [30, 30], 'in'], [20, [100, 100], 'out'], [24, [116, 100], 'inOut'], [32, [92, 100], 'inOut'], [F, [100, 100]]]),
    o: anim([[0, 10, 'in'], [20, 100, 'linear'], [F, 100]]),
  });
  return animation('Pick drop', 128, 128, F, [
    layer(1, 'pick', [pick], { ks: { s: [200, 200, 100] } }),
    layer(2, 'shadow', [shadow], { ks: { s: [200, 200, 100] } }),
  ]);
}

/** #2 Listening loop: kept for reference; the app uses the CSS wave (see the header). */
// eslint-disable-next-line no-unused-vars
function listening() {
  const F = 66;
  const heights = [12, 22, 30, 18, 26, 32, 14].map((h) => h * 2.2);
  const tones = [C.violet, C.violet, C.orange, C.violet, C.violet, C.mint, C.violet];
  const [barW, gap, H] = [12, 8, 96];
  const x0 = (160 - (7 * barW + 6 * gap)) / 2 + barW / 2;
  const bars = heights.map((h, n) => {
    const phase = (n * 0.37) % 1;
    const frames = [];
    for (let t = 0; t <= F; t += 6) {
      const y = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t / F + phase)));
      frames.push([t, [100, Math.round(y * 1000) / 10], 'inOut']);
    }
    const cx = x0 + n * (barW + gap);
    return group(`bar ${n + 1}`, [rect(cx, H / 2, barW, h, barW / 2), fill(tones[n])], { p: [cx, H / 2], a: [cx, H / 2], s: anim(frames) });
  });
  return animation('Listening loop', 160, H, F, [layer(1, 'bars', bars)]);
}

/** #3 Metronome, authored at 60 bpm (one swing per beat): play at speed = bpm / 60. */
function metronome() {
  const F = 120;
  const pivot = [32, 46];
  const arm = group(
    'arm',
    [
      group('weight', [rect(32, 24, 11, 8.5, 3), litGradient('orange', [29, 21], 9)]),
      group('rod', [path('M32 46L32 12'), stroke(C.ink, 2.6)]),
    ],
    { a: pivot, p: pivot, r: anim([[0, -23, 'inOut'], [F / 2, 23, 'inOut'], [F, -23]]) },
  );
  const ticks = [22, 28, 34, 40].map((y) => group(`tick ${y}`, [path(`M${30.5 - (y - 16) * 0.05} ${y}L${33.5 + (y - 16) * 0.05} ${y}`), stroke(C.violet, 1.2, 50)]));
  const body = [
    group('pivot', [ellipse(32, 46, 6, 6), fill(C.violetDeep)]),
    arm,
    group('base', [rect(32, 55, 44, 6, 3), fill(C.violetDeep)]),
    ...ticks,
    group('face', [path(METRONOME_FACE), fill(C.violetSoft, 85)]),
    group('body', [path(METRONOME_BODY), linearGradient([[0, C.violetSoft], [0.35, C.violet], [1, C.violetDeep]], [13, 30], [51, 30])]),
    group('shadow', [ellipse(32, 60, 42, 5.2), fill(C.violetDeep, 28)]),
  ];
  return animation('Metronome', 128, 128, F, [layer(1, 'metronome', body, { ks: { s: [200, 200, 100] } })]);
}

/** #4 Chord confirmed, 450 ms: a mint ring bursts out and fades; the tick badge pops in with overshoot. */
function chordConfirmed() {
  const F = 27;
  const c = [48, 48];
  const ring = group('ring', [ellipse(48, 48, 44, 44), stroke(C.mint, 4)], {
    p: c,
    a: c,
    s: anim([[0, [50, 50], 'out'], [F, [170, 170]]]),
    o: anim([[0, 100, 'in'], [F, 0]]),
  });
  const badge = group('badge', [group('check', [path('M39 48L45.5 54.5L57.5 42'), stroke(C.surface, 4)]), group('dot', [ellipse(48, 48, 36, 36), fill(C.mint)])], {
    p: c,
    a: c,
    s: anim([[0, [0, 0], 'out'], [14, [122, 122], 'inOut'], [20, [96, 96], 'inOut'], [F, [100, 100]]]),
  });
  return animation('Chord confirmed', 96, 96, F, [layer(1, 'badge', [badge]), layer(2, 'ring', [ring])]);
}

/** #8 First full play, 1.2 s: picks, dots and notes burst upward in brand colours. */
function firstPlay() {
  const F = 72;
  const [W, H] = [480, 320];
  const rand = random(8);
  const tones = [C.violet, C.orange, C.mint, C.rose];
  const pieces = Array.from({ length: 18 }, (_, n) => {
    const kind = ['pick', 'dot', 'note'][n % 3];
    const tone = tones[n % tones.length];
    const angle = (-90 + (rand() * 2 - 1) * 62) * (Math.PI / 180);
    const reach = 150 + rand() * 120;
    const start = [W / 2 + (rand() * 2 - 1) * 30, H - 30];
    const peak = [start[0] + Math.cos(angle) * reach, start[1] + Math.sin(angle) * reach];
    const end = [peak[0] + Math.cos(angle) * 40, peak[1] + 70 + rand() * 50];
    const delay = Math.round(rand() * 8);
    const shapes =
      kind === 'pick'
        ? [group('pick', [path(PICK_PATH), fill(tone)], { a: [32, 30], s: [32, 32] })]
        : kind === 'dot'
          ? [ellipse(0, 0, 10, 10), fill(tone)]
          : [group('stem', [rect(5, -9, 2.4, 18, 1.2), fill(tone)]), group('head', [ellipse(0, 0, 11, 8.5), fill(tone)], { r: -20 })];
    const spin = (rand() * 2 - 1) * 280;
    return group(`${kind} ${n + 1}`, kind === 'pick' ? shapes : [group('shape', shapes)], {
      p: anim([[delay, start, 'out'], [delay + 34, peak, 'in'], [F, end]]),
      s: anim([[delay, [0, 0], 'out'], [delay + 10, [100, 100], 'linear'], [F, [100, 100]]]),
      r: anim([[delay, 0, 'out'], [F, spin]]),
      o: anim([[delay, 100, 'linear'], [F - 22, 100, 'in'], [F, 0]]),
    });
  });
  return animation('First full play', W, H, F, [layer(1, 'burst', pieces)]);
}

// ---------- .lottie (zip) ----------

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A zip of deflated files (what a .lottie is), with a fixed date so builds are byte-identical. */
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text);
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt16LE(0, 10);
    head.writeUInt16LE(0x5a21, 12); // 2025-01-01
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    head.writeUInt16LE(0, 28);
    locals.push(head, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5a21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += head.length + nameBuf.length + packed.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const dotLottie = (id, json, loop) =>
  zip([
    ['manifest.json', JSON.stringify({ version: '1', generator: 'thumbline tools/make-lottie.mjs', author: 'Thumbline', animations: [{ id, loop, autoplay: false, speed: 1 }] })],
    [`animations/${id}.json`, JSON.stringify(json)],
  ]);

const MOMENTS = [
  ['pick-drop', pickDrop(), false],
  ['metronome', metronome(), true],
  ['chord-confirmed', chordConfirmed(), false],
  ['first-play', firstPlay(), false],
];

mkdirSync(OUT, { recursive: true });
for (const [id, json, loop] of MOMENTS) {
  const file = dotLottie(id, json, loop);
  if (file.length > MAX_BYTES) throw new Error(`${id}.lottie is ${file.length} bytes; the budget is ${MAX_BYTES} (motion.md)`);
  writeFileSync(`${OUT}${id}.lottie`, file);
  console.log(`${id}.lottie  ${(file.length / 1024).toFixed(1)} KB  ${((json.op / FPS) * 1000).toFixed(0)} ms${loop ? ' loop' : ''}`);
}

// The renderer, from the dotlottie-web version the UI package resolves.
const fromUi = createRequire(new URL('../packages/ui/package.json', import.meta.url).pathname);
const fromReact = createRequire(fromUi.resolve('@lottiefiles/dotlottie-react'));
// The WASM isn't in the package's exports: it sits next to the entry point.
const wasm = fromReact.resolve('@lottiefiles/dotlottie-web').replace(/[^/]+$/, 'dotlottie-player.wasm');
copyFileSync(wasm, `${OUT}dotlottie-player.wasm`);
console.log(`dotlottie-player.wasm  from ${wasm.split('node_modules/').pop()}`);
