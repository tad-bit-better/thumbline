import type { CSSProperties } from 'react';
import { LOOP_MS, usePageVisible, useReducedMotion } from '../../motion';
import { LoopGlyph, PauseGlyph, PlayGlyph } from '../glyphs';
import { IconButton } from '../IconButton/IconButton';
import { SegmentedControl } from '../SegmentedControl/SegmentedControl';
import styles from './PlayerBar.module.css';

export type PlayerMix = 'sheet' | 'original' | 'both';
export type PlayerSpeed = 0.5 | 0.75 | 1;

export type PlayerBarProps = {
  playing: boolean;
  /** Decoding or time-stretching before sound starts. */
  preparing?: boolean;
  onTogglePlay: () => void;
  /** e.g. "Fingerstyle, Moderate". */
  title: string;
  /** e.g. "92 bpm, sheet and original". */
  subtitle: string;
  mix: PlayerMix;
  onMixChange: (mix: PlayerMix) => void;
  /** No original recording: only the sheet can play. */
  mixDisabled?: boolean;
  speed: PlayerSpeed;
  onSpeedChange: (speed: PlayerSpeed) => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  className?: string;
};

const MIXES = [
  { value: 'sheet', label: 'Sheet' },
  { value: 'original', label: 'Original' },
  { value: 'both', label: 'Both' },
] as const;

const SPEEDS = [
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
] as const;

/** Sticky player: play sphere, now-playing line, mix, speed and loop. */
export function PlayerBar({
  playing,
  preparing = false,
  onTogglePlay,
  title,
  subtitle,
  mix,
  onMixChange,
  mixDisabled = false,
  speed,
  onSpeedChange,
  loop,
  onLoopChange,
  className,
}: PlayerBarProps) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const label = preparing ? 'Getting ready' : playing ? 'Pause' : 'Play';
  const button = (
    <button type="button" className={styles['play']} aria-label={label} aria-busy={preparing || undefined} onClick={onTogglePlay}>
      {preparing ? <span className={styles['spinner']} aria-hidden="true" /> : playing ? <PauseGlyph aria-hidden="true" /> : <PlayGlyph aria-hidden="true" />}
    </button>
  );
  return (
    <section
      aria-label="Player"
      className={[styles['bar'], !playing && !preparing && styles['idle'], className].filter(Boolean).join(' ')}
      style={{ '--breathe-period': `${LOOP_MS.breathe}ms` } as CSSProperties}
      data-paused={visible ? undefined : ''}
      data-reduced-motion={reduced ? '' : undefined}
    >
      {button}
      <div className={styles['now']}>
        <b>{title}</b>
        <p>{subtitle}</p>
      </div>
      <div className={styles['controls']}>
        <SegmentedControl
          label="What to hear"
          tone="secondary"
          options={MIXES.map((m) => ({ ...m, disabled: mixDisabled && m.value !== 'sheet' }))}
          value={mix}
          onChange={onMixChange}
        />
        <SegmentedControl
          label="Speed"
          tone="secondary"
          options={SPEEDS}
          value={String(speed) as '0.5' | '0.75' | '1'}
          onChange={(v) => onSpeedChange(Number(v) as PlayerSpeed)}
        />
        <IconButton label="Loop" icon={<LoopGlyph />} pressed={loop} onClick={() => onLoopChange(!loop)} />
      </div>
    </section>
  );
}
