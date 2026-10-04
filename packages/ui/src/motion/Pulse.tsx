import type { CSSProperties, ReactNode } from 'react';
import styles from './Pulse.module.css';
import { LOOP_MS } from './springs';
import { usePageVisible } from './usePageVisible';
import { useReducedMotion } from './useReducedMotion';

export type PulseProps = {
  children: ReactNode;
  /** `breathe` gently scales (idle play button); `ping` sends out a fading ring (attention dot). */
  variant?: 'breathe' | 'ping';
  periodMs?: number;
  className?: string;
};

/** A looping pulse that pauses when the tab is hidden and stops under reduced motion. */
export function Pulse({ children, variant = 'breathe', periodMs = LOOP_MS.breathe, className }: PulseProps) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  return (
    <span
      className={[styles['pulse'], styles[variant], className].filter(Boolean).join(' ')}
      style={{ '--pulse-period': `${periodMs}ms` } as CSSProperties}
      data-paused={visible ? undefined : ''}
      data-reduced-motion={reduced ? '' : undefined}
    >
      {children}
    </span>
  );
}
