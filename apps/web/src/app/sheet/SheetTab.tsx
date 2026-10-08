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
  TabSheet,
} from '@thumbline/tab-renderer';
import { Card } from '@thumbline/ui';
import { ViewTransition, type Ref } from 'react';
import type { SongSection } from '../../lib/sheet-view';
import { type DisplayPrefs, type Edits, songStore } from '../../lib/song-store';
import type { useFollowPlayhead } from '../../lib/use-follow-playhead';
import type { useSheetPlayer } from '../../lib/use-sheet-player';
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
  player: ReturnType<typeof useSheetPlayer>;
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
  player,
  follow,
  chords,
  tabRef,
  tabWidth,
  playerHeight,
}: SheetTabProps) {
  const toCheck = chords.flaggedBars.length;
  return (
    <div className={styles.layout}>
      {/* Focusable: on desktop the rail scrolls on its own, and keyboard users must be able to scroll it. */}
      <aside className={styles.right} aria-label="Chords" tabIndex={0}>
        <Card padding="sm" className={styles.panel}>
          <h2 className={styles.panelTitle}>Now and next</h2>
          <NowNext arrangement={arrangement} tick={player.position} />
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
        <ViewTransition name="chords-card">
          <div ref={tabRef} className={styles.tab}>
            <TabSheet
              arrangement={arrangement}
              width={tabWidth}
              variant="cards"
              sections={sections}
              size={display.tabSize}
              chordNames={display.chordNames}
              showFingers={display.fingers}
              cursorIndex={player.cursor}
              label={`${STYLE_NAMES[style]} tab`}
              onSeek={(tick) => {
                follow.resume();
                void player.seek(tick, true);
              }}
              follow={follow.following}
              jumpKey={follow.jumpKey}
              onPlayheadView={follow.onPlayheadView}
              coveredBottom={playerHeight}
              renderSectionActions={(tabSection) => {
                const section = sections.find((s) => s.id === tabSection.id);
                return section ? (
                  <SectionEditor
                    section={section}
                    sections={sections}
                    stored={edits.sections}
                    patterns={patterns}
                    songFullness={songFullness}
                    onChange={(key, choice) =>
                      songStore.getState().setSection(key, choice)
                    }
                  />
                ) : null;
              }}
              renderChords={(bar, names) => {
                const cell = chords.bars[bar];
                if (!cell) return names;
                const span = chords.spans[bar];
                const next = chords.nextFlagged(bar);
                return (
                  <BarChords
                    cell={cell}
                    heard={analysis}
                    confirmed={edits.confirmed}
                    flags={chords.flags}
                    onPick={(segment, chord) =>
                      chords.pickChord(bar, segment, chord)
                    }
                    onHear={
                      file && span
                        ? () => {
                            player.stop();
                            void chords.barPlayer.toggle(
                              bar,
                              span.start,
                              span.end,
                            );
                          }
                        : undefined
                    }
                    hearing={chords.barPlayer.playing === bar}
                    onNext={
                      next !== undefined
                        ? () => chords.openChord(next)
                        : undefined
                    }
                    nextLabel={`Next to check (${toCheck - (chords.flaggedBars.includes(bar) ? 1 : 0)} left)`}
                    burstKey={
                      chords.burst?.bar === bar ? chords.burst.key : undefined
                    }
                  >
                    {names}
                  </BarChords>
                );
              }}
            />
          </div>
        </ViewTransition>
      </section>
    </div>
  );
}
