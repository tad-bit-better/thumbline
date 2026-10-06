// The Thumbline mark's geometry on the 64 grid (shared by LogoMark and tools/make-icons.mjs).
// A thumbprint on the pick whose outer ridges flow out into the tab's strings.

/** Centre of the thumbprint's whorl. */
const CX = 24.5;
const CY = 28.5;
/** The ridges lean like a thumb's. */
const TILT = (-12 * Math.PI) / 180;
/** Where the strings end, inside the tile's right edge. */
const END = 55;
/** Where the strings run straight, past the pick's right edge. */
const STRAIGHT = 44;

export const PICK_TRANSFORM = 'translate(25 31) scale(0.84) translate(-32 -31)';
/** The region the ridges may draw in: the pick, and the strings' run to the right of it. */
export const STRINGS_REGION = { x: 37, y: 10, width: 20.5, height: 40 } as const;

export type Detail = 'full' | 'small';

const point = (rx: number, ry: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  const x = rx * Math.cos(a);
  const y = ry * Math.sin(a);
  return [CX + x * Math.cos(TILT) - y * Math.sin(TILT), CY + x * Math.sin(TILT) + y * Math.cos(TILT)];
};

const f = (n: number) => n.toFixed(2);

/** An elliptical arc around the whorl's centre as a smooth polyline, from `from`° to `to`° (0 = right, y down). */
function arc(rx: number, ry: number, from: number, to: number, steps = 40): string[] {
  return Array.from({ length: steps + 1 }, (_, i) => point(rx, ry, from + ((to - from) * i) / steps)).map(([x, y]) => `${f(x)} ${f(y)}`);
}

/** A ridge that loops round the left of the whorl and leaves to the right as two strings, at `top` and `bottom`. */
function flowing(rx: number, ry: number, top: number, bottom: number): string {
  const [tx, ty] = point(rx, ry, 270);
  const [bx, by] = point(rx, ry, 90);
  const loop = arc(rx, ry, 270, 90, 48);
  return (
    `M${END} ${top}H${STRAIGHT}C40.5 ${top} ${f(tx + 6)} ${f(ty)} ${f(tx)} ${f(ty)}` +
    `L${loop.slice(1).join(' L')}` +
    `C${f(bx + 6)} ${f(by)} 40.5 ${bottom} ${STRAIGHT} ${bottom}H${END}`
  );
}

/**
 * The ridges: a hooked core and broken loops (the thumbprint), then outer
 * ridges whose ends flow into evenly spaced strings. `full` has six strings
 * (three ridges); `small` (32px and under) two ridges, four strings, no core
 * detail, so it stays legible in a browser tab.
 */
export function ridges(detail: Detail): string[] {
  const loop = (rx: number, ry: number, from: number, to: number) => `M${arc(rx, ry, from, to).join(' L')}`;
  if (detail === 'small') {
    return [loop(1.8, 2.6, -70, 230), flowing(6.4, 7.8, 24, 33), flowing(9.6, 11.2, 17, 40)];
  }
  return [
    loop(1.4, 2, -80, 200),
    loop(3.3, 4.4, -60, 250),
    loop(5.2, 6.6, -30, 290),
    flowing(7.4, 8.9, 25.5, 31.5),
    flowing(9.6, 11.2, 20.5, 36.5),
    flowing(11.8, 13.4, 15.5, 41.5),
  ];
}

/** Fret numbers on three strings (full detail): x, string y, digit. */
export const FRETS = [
  { x: 48.5, y: 15.5, text: '0' },
  { x: 51, y: 25.5, text: '2' },
  { x: 48.5, y: 36.5, text: '5' },
] as const;

/** Ridge stroke width per detail (the small mark draws bolder lines). */
export const RIDGE_WIDTH: Record<Detail, number> = { full: 1.25, small: 2.2 };

/** Marks this size (px) and under draw the small detail. */
export const SMALL_BELOW = 32;
