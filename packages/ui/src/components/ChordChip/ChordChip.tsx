import type { ComponentPropsWithRef, ReactNode } from 'react';
import { CheckGlyph } from '../glyphs';
import styles from './ChordChip.module.css';

/** `check`: might be off; `likely`: likely off; `yours`: the reader chose it. */
export type ChordChipStatus = 'none' | 'check' | 'likely' | 'yours';

export type ChordChipProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  /** 1-based bar number, for the accessible name. */
  bar: number;
  /** The chord as drawn (may hold "sounds …" markup). */
  children: ReactNode;
  /** What a screen reader hears for the chord; defaults to the text drawn. */
  spoken?: string;
  status?: ChordChipStatus;
};

const SAID: Record<ChordChipStatus, string> = { none: '', check: ', might be off', likely: ', likely off', yours: ', your choice' };

/**
 * A bar's chord on the sheet as a button that opens its picker. A chord we're
 * unsure of carries a dot with a mark in it (orange "?" might be off, rose "!"
 * likely off), so it reads without colour; one the reader chose carries a tick.
 */
export function ChordChip({ bar, children, spoken, status = 'none', className, type = 'button', ...rest }: ChordChipProps) {
  const name = spoken ?? (typeof children === 'string' ? children : '');
  return (
    <button
      type={type}
      className={[styles['chip'], className].filter(Boolean).join(' ')}
      aria-label={`Bar ${bar}: ${name}${SAID[status]}. Change chord`}
      data-status={status}
      {...rest}
    >
      <span className={styles['name']}>{children}</span>
      {status === 'check' && (
        <span className={styles['dot']} data-dot="check" aria-hidden="true">
          ?
        </span>
      )}
      {status === 'likely' && (
        <span className={styles['dot']} data-dot="likely" aria-hidden="true">
          !
        </span>
      )}
      {status === 'yours' && (
        <span className={styles['dot']} data-dot="yours" aria-hidden="true">
          <CheckGlyph />
        </span>
      )}
    </button>
  );
}
