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

export const StopGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

export const LoopGlyph =(p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M17 3l3 3-3 3" />
    <path d="M4 12V10a4 4 0 0 1 4-4h12" />
    <path d="M7 21l-3-3 3-3" />
    <path d="M20 12v2a4 4 0 0 1-4 4H4" />
  </svg>
);

/** Back one step: a bar line, then a triangle pointing back. */
export const BackGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M6 5.5v13" />
    <path d="M18 6.5v11L9.5 12z" fill="currentColor" stroke="none" />
  </svg>
);

/** Forward one step: a triangle, then a bar line. */
export const ForwardGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M18 5.5v13" />
    <path d="M6 6.5v11l8.5-5.5z" fill="currentColor" stroke="none" />
  </svg>
);

/** Previous and next in a list (not playback): chevrons. */
export const ChevronLeftGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </svg>
);

export const ChevronRightGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </svg>
);

/** Up and down arrows, e.g. "the playhead is above / below". */
export const ArrowUpGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const ArrowDownGlyph = (p: GlyphProps) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
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
