// The "glossy toy" recipe from docs/design/design-system.md, as shared SVG pieces.
// Colours go through `style` because CSS variables don't work in SVG presentation attributes.
import { type ReactNode, useId } from 'react';

export type Tone = 'violet' | 'mint' | 'rose' | 'orange';

export type Icon3DProps = {
  /** Pixel size; the art is drawn on a 64 grid. */
  size?: number;
  /** Accessible name. Without it the icon is decorative. */
  label?: string;
  className?: string;
};

export const color = (tone: Tone | 'surface' | 'ink' | 'string', shade?: 'soft' | 'deep') =>
  `var(--color-${tone}${shade ? `-${shade}` : ''})`;

/** Unique, url()-safe ids for one icon instance. */
export function useIconIds<K extends string>(...names: K[]): Record<K, string> {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return Object.fromEntries(names.map((n) => [n, `i3d-${base}-${n}`])) as Record<K, string>;
}

export function Frame({ size = 64, label, className, children }: Icon3DProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
      data-tilt=""
      className={className}
      style={{ overflow: 'visible' }}
    >
      {children}
    </svg>
  );
}

/** Vertical tile gradient: soft at the top to deep at the bottom. */
export function TileGradient({ id, tone }: { id: string; tone: Tone }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style={{ stopColor: color(tone, 'soft') }} />
      <stop offset="0.3" style={{ stopColor: color(tone) }} />
      <stop offset="1" style={{ stopColor: color(tone, 'deep') }} />
    </linearGradient>
  );
}

/** Radial "lit object" gradient, light source top-left (cx 35%, cy 28%). */
export function LitGradient({ id, tone }: { id: string; tone: Tone }) {
  return (
    <radialGradient id={id} cx="0.35" cy="0.28" r="0.8">
      <stop offset="0" style={{ stopColor: color(tone, 'soft') }} />
      <stop offset="0.35" style={{ stopColor: color(tone) }} />
      <stop offset="1" style={{ stopColor: color(tone, 'deep') }} />
    </radialGradient>
  );
}

/** Pale lit gradient for white objects (balls, fan). */
export function PaleGradient({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="0.35" cy="0.28" r="0.8">
      <stop offset="0" style={{ stopColor: color('surface') }} />
      <stop offset="0.55" style={{ stopColor: color('violet', 'soft') }} />
      <stop offset="1" style={{ stopColor: color('string') }} />
    </radialGradient>
  );
}

export function BlurFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-50%" y="-200%" width="200%" height="500%">
      <feGaussianBlur stdDeviation="1.6" />
    </filter>
  );
}

/** Blurred ellipse under the object in the deep colour. */
export function GroundShadow({ filter, tone, cx = 32, cy = 59, rx = 19 }: { filter: string; tone: Tone; cx?: number; cy?: number; rx?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={2.6} filter={`url(#${filter})`} style={{ fill: color(tone, 'deep'), opacity: 0.28 }} />;
}

/** Rounded tile (rx ≈ 28%) with a gloss band across the top third. */
export function Tile({ gradient }: { gradient: string }) {
  return (
    <>
      <rect x="6" y="5" width="52" height="51" rx="15" fill={`url(#${gradient})`} />
      <rect x="10" y="8" width="44" height="15" rx="8" style={{ fill: color('surface'), opacity: 0.2 }} />
    </>
  );
}

/** Small white highlight on an object. */
export function Specular({ cx, cy, rx = 5, ry = 3, rotate = -20, opacity = 0.65 }: { cx: number; cy: number; rx?: number; ry?: number; rotate?: number; opacity?: number }) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      transform={`rotate(${rotate} ${cx} ${cy})`}
      style={{ fill: color('surface'), opacity }}
    />
  );
}

export const PICK_PATH = 'M32 9C44 9 51 14 51 22C51 33 41 46 32 54C23 46 13 33 13 22C13 14 20 9 32 9Z';
