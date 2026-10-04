import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { LOOP_MS, Pulse, useReducedMotion } from '../../motion';
import { CheckGlyph } from '../glyphs';
import styles from './ChordBlock.module.css';

export type ChordBlockStatus = 'normal' | 'low' | 'confirmed';

export type ChordBlockProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  /** 1-based bar number as shown. */
  bar: number;
  /** Chord name as displayed, or null for no chord. */
  chord: string | null;
  /** What screen readers hear instead of `chord` (e.g. "no chord" for a "—"). */
  spoken?: string;
  status?: ChordBlockStatus;
  /** Its popover is showing. */
  open?: boolean;
};

/** A stable little waveform per bar (decoration, not real audio). */
function wave(bar: number) {
  return Array.from({ length: 6 }, (_, i) => 6 + ((bar * 7 + i * 5 + (bar % 3) * i) % 11));
}

/** One bar on the Review screen: number, chord name and a mini waveform. */
export function ChordBlock({ bar, chord, spoken, status = 'normal', open = false, className, type = 'button', ...rest }: ChordBlockProps) {
  const reduced = useReducedMotion();
  const suffix = status === 'low' ? ', not sure, tap to choose' : status === 'confirmed' ? ', confirmed' : '';
  return (
    <span
      className={[styles['wrap'], styles[status], open && styles['open'], className].filter(Boolean).join(' ')}
      style={{ '--wiggle-period': `${LOOP_MS.wiggle}ms` } as CSSProperties}
      data-reduced-motion={reduced ? '' : undefined}
    >
      <button
        type={type}
        className={styles['block']}
        aria-label={`Bar ${bar}: ${spoken ?? chord ?? 'no chord'}${suffix}`}
        data-status={status}
        data-open={open ? '' : undefined}
        data-reduced-motion={reduced ? '' : undefined}
        {...rest}
      >
        <span className={styles['number']} aria-hidden="true">
          {bar}
        </span>
        <span
          className={[styles['name'], chord ? '' : styles['none']].join(' ')}
          data-long={chord && chord.length > 5 ? '' : undefined}
          aria-hidden="true"
        >
          {chord ?? '—'}
        </span>
        <span className={styles['wave']} aria-hidden="true" data-wave="">
          {wave(bar).map((h, i) => (
            <span key={i} style={{ height: h }} />
          ))}
        </span>
      </button>
      {status === 'low' && !open && (
        <Pulse variant="ping" periodMs={LOOP_MS.ping} className={styles['ping']}>
          <span data-ping="" />
        </Pulse>
      )}
      {status === 'confirmed' && (
        <span className={styles['tick']} aria-hidden="true" data-tick="">
          <CheckGlyph />
        </span>
      )}
    </span>
  );
}
