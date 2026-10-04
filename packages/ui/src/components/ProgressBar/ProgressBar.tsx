import type { CSSProperties } from 'react';
import { LOOP_MS, usePageVisible, useReducedMotion } from '../../motion';
import styles from './ProgressBar.module.css';

export type ProgressBarProps = {
  label: string;
  /** 0..1; omit while the length of the work is unknown. */
  value?: number;
  /** Spoken instead of the percentage, e.g. "bar 23 of 48". */
  valueText?: string;
  className?: string;
};

/** Rounded progress bar with a moving shimmer. */
export function ProgressBar({ label, value, valueText, className }: ProgressBarProps) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const pct = value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={valueText}
      className={[styles['track'], pct === undefined && styles['indeterminate'], className].filter(Boolean).join(' ')}
      style={{ '--shimmer-period': `${LOOP_MS.shimmer}ms` } as CSSProperties}
      data-paused={visible ? undefined : ''}
      data-reduced-motion={reduced ? '' : undefined}
    >
      <div className={styles['fill']} style={pct === undefined ? undefined : { width: `${pct}%` }} />
    </div>
  );
}
