// Flat, single-colour UI glyphs (24px grid, currentColor). The glossy 3D set lives in icons3d.
import type { SVGProps } from 'react';

type GlyphProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const PlayGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </svg>
);

export const LoopGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M17 3l3 3-3 3" />
    <path d="M4 12V10a4 4 0 0 1 4-4h12" />
    <path d="M7 21l-3-3 3-3" />
    <path d="M20 12v2a4 4 0 0 1-4 4H4" />
  </svg>
);

export const CloseGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const CheckGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const UploadGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);
