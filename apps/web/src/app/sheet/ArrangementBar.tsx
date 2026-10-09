import {
  Button,
  Card,
  Checkbox,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  IconButton,
  Popover,
  SegmentedControl,
} from '@thumbline/ui';
import { type DisplayPrefs, songStore } from '../../lib/song-store';
import styles from './sheet.module.css';
import { CHORD_NAME_OPTIONS, TAB_SIZES } from './sheet-labels';
import { memo } from 'react';

export type ArrangementBarProps = {
  /** "Fingerstyle · Advanced · Warm · Pop groove". */
  line: string;
  patternIndex: number;
  patternCount: number;
  display: DisplayPrefs;
  onCustomize: () => void;
};

/** The arrangement in one line, pattern stepping, the Display popover and Customize. */
export const ArrangementBar = memo(function ArrangementBar({
  line,
  patternIndex,
  patternCount,
  display,
  onCustomize,
}: ArrangementBarProps) {
  const set = (d: Partial<DisplayPrefs>) => songStore.getState().setDisplay(d);
  return (
    <Card padding="sm" className={styles.arrangementBar}>
      <div className={styles.arrangementText}>
        <p className={styles.eyebrow}>Arrangement</p>
        <b>{line}</b>
      </div>
      <div className={styles.arrangementActions}>
        {patternCount > 1 && (
          <div className={styles.patternStep}>
            <IconButton
              label="Previous pattern"
              icon={<ChevronLeftGlyph />}
              variant="ghost"
              onClick={() =>
                songStore.getState().cyclePattern(patternCount, -1)
              }
            />
            <span aria-live="polite">
              Pattern {patternIndex + 1} of {patternCount}
            </span>
            <IconButton
              label="Next pattern"
              icon={<ChevronRightGlyph />}
              variant="ghost"
              onClick={() => songStore.getState().cyclePattern(patternCount)}
            />
          </div>
        )}
        <Popover
          label="Display"
          className={styles.displayPanel}
          trigger={({ ref, ...props }) => (
            <Button
              variant="secondary"
              ref={ref as (el: HTMLButtonElement | null) => void}
              {...props}
            >
              Display
            </Button>
          )}
        >
          <div className={styles.displayOptions}>
            <p className={styles.optionLabel}>Chord names</p>
            <SegmentedControl
              label="Chord names"
              fullWidth
              tone="secondary"
              options={CHORD_NAME_OPTIONS}
              value={display.chordNames}
              onChange={(chordNames) => set({ chordNames })}
            />
            <p className={styles.optionLabel}>Tab size</p>
            <SegmentedControl
              label="Tab size"
              fullWidth
              tone="secondary"
              options={TAB_SIZES}
              value={display.tabSize}
              onChange={(tabSize) => set({ tabSize })}
            />
            <Checkbox
              label="Fingering letters"
              checked={display.fingers}
              onChange={(fingers) => set({ fingers })}
            />
            <Checkbox
              label="Legend"
              checked={display.legend}
              onChange={(legend) => set({ legend })}
            />
          </div>
        </Popover>
        <Button onClick={onCustomize}>Customize</Button>
      </div>
    </Card>
  );
});
