import type {
  AnalysisResult,
  Arrangement,
  PatternDef,
  Style,
} from '@thumbline/engine';
import {
  ChordShapes,
  NowNext,
  TabLegend,
  type TabSection,
  TabSheet,
} from '@thumbline/tab-renderer';
import { Card } from '@thumbline/ui';
import { type ReactNode, type Ref, ViewTransition, useCallback, useEffect, useRef } from 'react';
import type { SongSection } from '../../lib/sheet-view';
import { type DisplayPrefs, type Edits, songStore } from '../../lib/song-store';
import type { useFollowPlayhead } from '../../lib/use-follow-playhead';
import { BarChords } from './bar-chords';
import { SectionEditor } from './section-editor';
import { STYLE_NAMES } from './sheet-labels';
import styles from './sheet.module.css';
import type { useChordChecking } from './use-chord-checking';

export type SheetTabProps = {
  arrangement: Arrangement;
  /** The song as heard: what the chord pickers suggest. */
  analysis: AnalysisResult;
  file: Blob | null;
  style: Style;
  sections: readonly SongSection[];
  patterns: readonly PatternDef[];
  songFullness: number;
  edits: Edits;
  display: DisplayPrefs;
  /** The note being played (index into the arrangement's events) and its tick. */
  cursor: number | undefined;
  position: number;
  /** Play from a tick (a tap on the tab). */
  seek: (tick: number) => void;
  /** Stop the sheet playing (before "Hear this bar"). */
  stopPlayer: () => void;
  follow: ReturnType<typeof useFollowPlayhead>;
  chords: ReturnType<typeof useChordChecking>;
  tabRef: Ref<HTMLDivElement>;
  tabWidth: number;
  /** Px the sticky player covers at the bottom of the window. */
  playerHeight: number;
};

/**
 * The sheet's two columns: now/next and chord shapes, and the tab as bar cards
 * whose chords open a picker and whose sections can be edited (screens.md §4).
 */
export function SheetTab({
  arrangement,
  analysis,
  file,
  style,
  sections,
  patterns,
  songFullness,
  edits,
  display,
  cursor,
  position,
  seek,
  stopPlayer,
  follow,
  chords,
  tabRef,
  tabWidth,
  playerHeight,
}: SheetTabProps) {
  // Actions read the latest props through a ref: the callbacks below change only with what they show,
  // so the tab's cards don't draw again on every played note.
  const latest = useRef({ chords, seek, stopPlayer, follow });
  useEffect(() => {
    latest.current = { chords, seek, stopPlayer, follow };
  });
  const { bars, spans, flags, flaggedBars, burst } = chords;
  const hearing = chords.barPlayer.playing;
  const confirmed = edits.confirmed;
  const renderChords = useCallback(
    (bar: number, names: ReactNode) => {
      const cell = bars[bar];
      if (!cell) return names;
      const span = spans[bar];
      const next = latest.current.chords.nextFlagged(bar);
      return (
        <BarChords
          cell={cell}
          heard={analysis}
          confirmed={confirmed}
          flags={flags}
          onPick={(segment, chord) =>
            latest.current.chords.pickChord(bar, segment, chord)
          }
          onHear={
            file && span
              ? () => {
                  latest.current.stopPlayer();
                  void latest.current.chords.barPlayer.toggle(
                    bar,
                    span.start,
                    span.end,
                  );
                }
              : undefined
          }
          hearing={hearing === bar}
          onNext={
            next !== undefined
              ? () => latest.current.chords.openChord(next)
              : undefined
          }
          nextLabel={`Next to check (${flaggedBars.length - (flaggedBars.includes(bar) ? 1 : 0)} left)`}
          burstKey={burst?.bar === bar ? burst.key : undefined}
        >
          {names}
        </BarChords>
      );
    },
    // flaggedBars stands in for nextFlagged, which only reads it.
    [bars, spans, flags, flaggedBars, burst, hearing, analysis, confirmed, file],
  );
  const renderSectionActions = useCallback(
    (tabSection: TabSection) => {
      const section = sections.find((s) => s.id === tabSection.id);
      return section ? (
        <SectionEditor
          section={section}
          sections={sections}
          stored={edits.sections}
          patterns={patterns}
          songFullness={songFullness}
          onChange={(key, choice) => songStore.getState().setSection(key, choice)}
        />
      ) : null;
    },
    [sections, edits.sections, patterns, songFullness],
  );
  const onSeek = useCallback((tick: number) => {
    latest.current.follow.resume();
    latest.current.seek(tick);
  }, []);
  return (
    <div className={styles.layout}>
      {/* Focusable: on desktop the rail scrolls on its own, and keyboard users must be able to scroll it. */}
      <aside className={styles.right} aria-label="Chords" tabIndex={0}>
        <Card padding="sm" className={styles.panel}>
          <h2 className={styles.panelTitle}>Now and next</h2>
          <NowNext arrangement={arrangement} tick={position} />
        </Card>
        <Card
          padding="sm"
          className={[styles.panel, styles.shapesPanel].join(' ')}
        >
          <h2 className={styles.panelTitle}>Chord shapes</h2>
          <ChordShapes arrangement={arrangement} variant="list" />
        </Card>
      </aside>

      <section className={styles.center} aria-labelledby="tab-title">
        <h2 id="tab-title" className={styles.srOnly}>
          Tab
        </h2>
        {display.legend && <TabLegend arrangement={arrangement} />}
        {/* Morphs between screens only: a new arrangement pops its notes in (moment #5), it doesn't cross-fade. */}
        <ViewTransition name="chords-card" update="none">
          <div ref={tabRef} className={styles.tab}>
            <TabSheet
              arrangement={arrangement}
              width={tabWidth}
              variant="cards"
              sections={sections}
              size={display.tabSize}
              chordNames={display.chordNames}
              showFingers={display.fingers}
              cursorIndex={cursor}
              label={`${STYLE_NAMES[style]} tab`}
              onSeek={onSeek}
              follow={follow.following}
              jumpKey={follow.jumpKey}
              onPlayheadView={follow.onPlayheadView}
              coveredBottom={playerHeight}
              renderSectionActions={renderSectionActions}
              renderChords={renderChords}
            />
          </div>
        </ViewTransition>
      </section>
    </div>
  );
}
