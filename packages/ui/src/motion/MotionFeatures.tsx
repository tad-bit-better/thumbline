import { LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

const load = () => import('./features').then((m) => m.default);

/**
 * Loads motion's animation features after the page renders, so they stay out
 * of the first-load JavaScript (README: performance budget). Components use
 * `m.*`, which animates once the features arrive; until then (or without this
 * provider, as in unit tests) they render still.
 */
export function MotionFeatures({ children }: { children: ReactNode }) {
  return <LazyMotion features={load}>{children}</LazyMotion>;
}
