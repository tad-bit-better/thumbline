import type { CSSProperties } from 'react';
import { LOOP_MS, usePageVisible, useReducedMotion } from '../../motion';
import { BackGlyph, ForwardGlyph, LoopGlyph, PauseGlyph, PlayGlyph } from '../glyphs';
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
  /** How loud the original is under the sheet in Both, 0–1. With its handler, a volume slider shows while both play. */
  originalLevel?: number;
  onOriginalLevelChange?: (level: number) => void;
  /** No original recording: only the sheet can play. */
  mixDisabled?: boolean;
  speed: PlayerSpeed;
  onSpeedChange: (speed: PlayerSpeed) => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  /**
   * Where the song is, by bar (0-based), for the back/forward buttons and the
   * position slider. Omit to hide them.
   */
  position?: { bar: number; bars: number };
  /** Jump to a bar (0-based). */
  onSeek?: (bar: number) => void;
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
  originalLevel,
  onOriginalLevelChange,
  mixDisabled = false,
  speed,
  onSpeedChange,
  loop,
  onLoopChange,
  position,
  onSeek,
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
        {mix === 'both' && !mixDisabled && originalLevel !== undefined && onOriginalLevelChange && (
          // DESIGN-REVIEW: not in screens.md; the user asked to keep the recording quiet under the sheet (2026-10-06).
          <label className={styles['volume']}>
            <span aria-hidden="true">Original volume</span>
            <input
              type="range"
              className={styles['slider']}
              aria-label="Original volume"
              aria-valuetext={`${Math.round(originalLevel * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              value={originalLevel}
              onChange={(e) => onOriginalLevelChange(Number(e.currentTarget.value))}
            />
          </label>
        )}
        <SegmentedControl
          label="Speed"
          tone="secondary"
          options={SPEEDS}
          value={String(speed) as '0.5' | '0.75' | '1'}
          onChange={(v) => onSpeedChange(Number(v) as PlayerSpeed)}
        />
        <IconButton label="Loop" icon={<LoopGlyph />} pressed={loop} onClick={() => onLoopChange(!loop)} />
      </div>
      {position && onSeek && position.bars > 0 && (
        // DESIGN-REVIEW: not in screens.md; a seek row under the controls, full width so the slider is usable.
        <div className={styles['seek']}>
          <IconButton label="Back one bar" icon={<BackGlyph />} disabled={position.bar <= 0} onClick={() => onSeek(Math.max(0, position.bar - 1))} />
          <input
            type="range"
            className={styles['slider']}
            aria-label="Position in song"
            aria-valuetext={`Bar ${position.bar + 1} of ${position.bars}`}
            min={0}
            max={Math.max(0, position.bars - 1)}
            step={1}
            value={Math.min(position.bar, position.bars - 1)}
            onChange={(e) => onSeek(Number(e.currentTarget.value))}
          />
          <IconButton
            label="Forward one bar"
            icon={<ForwardGlyph />}
            disabled={position.bar >= position.bars - 1}
            onClick={() => onSeek(Math.min(position.bars - 1, position.bar + 1))}
          />
          <span className={styles['where']} aria-hidden="true">
            Bar {position.bar + 1} of {position.bars}
          </span>
        </div>
      )}
    </section>
  );
}
