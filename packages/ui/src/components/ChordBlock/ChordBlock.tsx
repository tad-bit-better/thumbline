import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { LOOP_MS, Pulse, useReducedMotion } from '../../motion';
import { CheckGlyph, PlayGlyph, StopGlyph } from '../glyphs';
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
  /** Where the bar starts in the clip, as shown ("0:24"). */
  time?: string;
  /** Section letter, set on the first bar of a section ("A"). */
  section?: string;
  /** Shows a play button beside the chord; called on each press (start or stop). */
  onPlay?: () => void;
  /** This bar is playing: the play button shows stop and the block lights up. */
  playing?: boolean;
  /** Accessible name of the play button; defaults to "Play bar 5 (0:24)". */
  playLabel?: string;
};

/** A stable little waveform per bar (decoration, not real audio). */
function wave(bar: number) {
  return Array.from({ length: 6 }, (_, i) => 6 + ((bar * 7 + i * 5 + (bar % 3) * i) % 11));
}

/**
 * One bar on the Review screen: number, start time, chord name and a mini
 * waveform, with an optional section letter and a button to hear the bar.
 */
export function ChordBlock({
  bar,
  chord,
  spoken,
  status = 'normal',
  open = false,
  time,
  section,
  onPlay,
  playing = false,
  playLabel,
  disabled,
  className,
  type = 'button',
  ...rest
}: ChordBlockProps) {
  const reduced = useReducedMotion();
  const suffix = status === 'low' ? ', not sure, tap to choose' : status === 'confirmed' ? ', confirmed' : '';
  const where = `Bar ${bar}${time ? ` at ${time}` : ''}`;
  const label = `${section ? `Section ${section} starts. ` : ''}${where}: ${spoken ?? chord ?? 'no chord'}${suffix}`;
  return (
    <span
      className={[styles['wrap'], styles[status], open && styles['open'], playing && styles['playing'], className]
        .filter(Boolean)
        .join(' ')}
      style={{ '--wiggle-period': `${LOOP_MS.wiggle}ms` } as CSSProperties}
      data-reduced-motion={reduced ? '' : undefined}
      data-playable={onPlay ? '' : undefined}
    >
      <button
        type={type}
        className={styles['block']}
        aria-label={label}
        data-status={status}
        data-open={open ? '' : undefined}
        data-playing={playing ? '' : undefined}
        data-reduced-motion={reduced ? '' : undefined}
        disabled={disabled}
        {...rest}
      >
        <span className={styles['top']} aria-hidden="true">
          {section && (
            <span className={styles['section']} data-section="">
              {section}
            </span>
          )}
          <span className={styles['number']}>{bar}</span>
          {time && (
            <span className={styles['time']} data-time="">
              {time}
            </span>
          )}
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
      {onPlay && (
        <button
          type="button"
          className={styles['play']}
          aria-label={playLabel ?? `Play bar ${bar}${time ? ` (${time})` : ''}`}
          aria-pressed={playing}
          disabled={disabled}
          data-reduced-motion={reduced ? '' : undefined}
          onClick={onPlay}
        >
          <span className={styles['playGlyph']} aria-hidden="true">
            {playing ? <StopGlyph /> : <PlayGlyph />}
          </span>
        </button>
      )}
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
