import type { Transition } from 'motion/react';

// Spring equivalents of the CSS easing tokens, from docs/design/motion.md.
// `motion/react` needs numbers, so these are the single source for JS springs.

/** --ease-snap: button press, chip select, hover lift. */
export const SPRING_SNAP: Transition = { type: 'spring', stiffness: 500, damping: 28 };

/** --ease-bounce: pill slide, popovers, icon tilt, ticks. */
export const SPRING_BOUNCE: Transition = { type: 'spring', stiffness: 380, damping: 22 };

/** Loop periods from docs/design/motion.md, in ms. */
export const LOOP_MS = {
  /** Low-confidence ping dot. */
  ping: 1400,
  /** Low-confidence wiggle. */
  wiggle: 2400,
  /** Progress bar shimmer sweep. */
  shimmer: 1600,
  /** Idle play button breathing glow. */
  breathe: 2400,
  /** Floating pick on the Upload drop zone. */
  bob: 2600,
  /** Marching dashed border on the drop zone. */
  march: 2400,
} as const;

/** How long a toast stays up, in ms. */
export const TOAST_MS = 4000;
