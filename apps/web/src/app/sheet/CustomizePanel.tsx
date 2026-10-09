import {
  type Level,
  type Mood,
  type MoodLabel,
  type PatternDef,
  type Style,
  moodLabelOf,
} from '@thumbline/engine';
import { Button, Card, Drawer, SegmentedControl, Slider } from '@thumbline/ui';
import {
  MOOD_OPTIONS,
  colourWords,
  energyWords,
  moodName,
  presetValues,
} from '../../lib/mood';
import { type Edits, type SheetPrefs, songStore } from '../../lib/song-store';
import styles from './sheet.module.css';
import {
  FULLNESS_NOTE,
  LEVELS,
  METERS,
  PALOS,
  STYLE_HINTS,
  STYLE_OPTIONS,
  TEMPO_SCALES,
  fullnessWords,
} from './sheet-labels';
import { useSettled } from './use-settled';
import { memo } from 'react';

export type CustomizePanelProps = {
  open: boolean;
  onClose: () => void;
  /** Stop all sound before the beats are regrouped (meter, tempo). */
  stopAudio: () => void;
  bpm: number;
  beatsPerBar: number;
  style: Style;
  flamencoOk: boolean;
  prefs: SheetPrefs;
  edits: Edits;
  /** The mood the sheet plays with (the reader's, else what we heard), and what we heard. */
  mood?: Mood;
  heardMood?: MoodLabel;
  pattern: PatternDef | null;
  patternCount: number;
};

/** The Customize side panel: time, tempo, style, level, palo, fullness, the feel, and the pattern (screens.md §4). */
export const CustomizePanel = memo(function CustomizePanel({
  open,
  onClose,
  stopAudio,
  bpm,
  beatsPerBar,
  style,
  flamencoOk,
  prefs,
  edits,
  mood,
  heardMood,
  pattern,
  patternCount,
}: CustomizePanelProps) {
  const store = songStore.getState;
  const fullness = useSettled(prefs.fullness, (f) => store().setFullness(f));
  const feel = useSettled<Mood | undefined>(
    mood,
    (m) => m && store().setMood(m),
  );
  const shownMood = feel.shown;
  return (
    <Drawer open={open} title="Customize" onClose={onClose}>
      <div className={styles.customize}>
        <h3 className={styles.panelTitle}>Time</h3>
        <SegmentedControl
          label="Time"
          fullWidth
          options={METERS}
          value={String(beatsPerBar) as '4' | '3'}
          onChange={(v) => {
            stopAudio();
            store().setMeter(Number(v) as 3 | 4);
          }}
        />
        <h3 className={styles.panelTitle}>Tempo</h3>
        <SegmentedControl
          label="Tempo"
          fullWidth
          options={TEMPO_SCALES}
          value={String(edits.tempoScale ?? 1) as '0.5' | '1' | '2'}
          onChange={(v) => {
            stopAudio();
            store().setTempoScale(Number(v) as 0.5 | 1 | 2);
          }}
        />
        <p className={styles.hint}>
          {edits.tempoScale === 0.5
            ? `Counted at half the speed we heard: ${Math.round(bpm)} bpm.`
            : edits.tempoScale === 2
              ? `Counted at double the speed we heard: ${Math.round(bpm)} bpm.`
              : 'If the sheet races ahead of the song or drags behind it, try half or double.'}
        </p>
        <h3 className={styles.panelTitle}>Style</h3>
        <SegmentedControl
          label="Style"
          fullWidth
          options={STYLE_OPTIONS.map((o) =>
            o.value === 'flamenco' && !flamencoOk
              ? { ...o, disabled: true }
              : o,
          )}
          value={style}
          onChange={(v: Style) => store().setStyle(v)}
        />
        <p className={styles.hint}>
          {STYLE_HINTS[style]}
          {!flamencoOk && ' Flamenco needs a song in 4/4.'}
        </p>

        <div className={styles.levelRow}>
          <h3 className={styles.panelTitle}>Level</h3>
          <SegmentedControl
            fullWidth
            label="Level"
            options={LEVELS}
            value={prefs.level}
            onChange={(v: Level) => store().setLevel(v)}
          />
          {style === 'flamenco' && (
            // DESIGN-REVIEW: screens.md shows the palo only as the card's sub-label; this is how you pick it.
            <SegmentedControl
              label="Palo"
              options={PALOS}
              value={prefs.palo}
              onChange={(v) => store().setPalo(v)}
            />
          )}
          <Slider
            label={`Fullness: ${fullness.shown} of 10`}
            minLabel="Sparse"
            maxLabel="Full"
            value={(fullness.shown - 1) / 9}
            step={1 / 9}
            valueText={(v) => fullnessWords(Math.round(1 + v * 9))}
            onChange={(v) => fullness.nudge(Math.round(1 + v * 9))}
          />
          <p className={styles.fullnessNote}>{FULLNESS_NOTE}</p>
          {shownMood && (
            <Card padding="sm" className={styles.feel}>
              <SegmentedControl
                label="Mood"
                tone="secondary"
                fullWidth
                options={MOOD_OPTIONS}
                value={moodLabelOf(shownMood)}
                onChange={(v) => feel.nudge(presetValues(v))}
              />
              <Slider
                label="Energy"
                minLabel="Calm"
                maxLabel="Driving"
                value={shownMood.energy}
                valueText={(v) => `${Math.round(v * 100)}%, ${energyWords(v)}`}
                onChange={(energy) => feel.nudge({ ...shownMood, energy })}
              />
              <Slider
                label="Colour"
                minLabel="Dark"
                maxLabel="Bright"
                value={shownMood.valence}
                valueText={(v) => `${Math.round(v * 100)}%, ${colourWords(v)}`}
                onChange={(valence) => feel.nudge({ ...shownMood, valence })}
              />
              {heardMood && edits.mood && (
                <p className={styles.feelNote}>
                  It sounded {moodName(heardMood).toLowerCase()} to us.{' '}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      feel.cancel();
                      store().resetMood();
                    }}
                  >
                    Use what we heard
                  </Button>
                </p>
              )}
            </Card>
          )}
          {pattern && (
            <Card padding="sm" className={styles.pattern}>
              <div>
                <b>{pattern.name}</b>
                <p>{pattern.hint}</p>
              </div>
              {patternCount > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => store().cyclePattern(patternCount)}
                >
                  Try another pattern
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </Drawer>
  );
});
