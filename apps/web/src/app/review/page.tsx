'use client';

import { type ChordLabel, chordName, moodLabelOf } from '@thumbline/engine';
import {
  Button,
  Card,
  ChordBlock,
  type ChordBlockStatus,
  LottieMoment,
  Popover,
  SegmentedControl,
  Stepper,
} from '@thumbline/ui';
import { useRouter } from 'next/navigation';
import { ViewTransition, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, STEPS } from '../../components/AppShell';
import {
  type BarCell,
  type BarSegment,
  LOW_CONFIDENCE,
  barSpans,
  toBars,
} from '../../lib/bars';
import { formatClock } from '../../lib/format';
import { MOOD_OPTIONS, detectedMood, effectiveMood, moodName, presetValues } from '../../lib/mood';
import { LOTTIE } from '../../lib/lottie';
import { findSections, hasRepeats } from '../../lib/sections';
import { effectiveAnalysis, songStore, useSong } from '../../lib/song-store';
import { useBarPlayer } from '../../lib/use-bar-player';
import styles from './review.module.css';

const PAGE = 16;
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const METERS = [
  { value: '4', label: '4/4' },
  { value: '3', label: '3/4' },
] as const;

const displayName = (c: ChordLabel | null) => (c ? chordName(c) : '—');
const spokenName = (c: ChordLabel | null) => (c ? chordName(c) : 'no chord');
/** The chords shown for a bar: those starting in it, or the one carried in. */
const chordsOf = (cell: BarCell) =>
  cell.segments.length
    ? cell.segments.map((s) => s.chord)
    : [cell.sounding?.chord ?? null];
// DESIGN-REVIEW: the design shows a percentage per alternative, but AnalysisResult
// only ranks alternatives (no scores). Bars show rank, not invented percentages.
const RANK_WIDTH = [100, 62, 40, 26];

function Options({
  cell,
  edited,
  onPick,
}: {
  cell: BarCell;
  edited: number[];
  onPick: (seg: BarSegment, chord: ChordLabel) => void;
}) {
  // A silent stretch has nothing to choose from; leave it out.
  const groups = (
    cell.segments.length ? cell.segments : cell.sounding ? [cell.sounding] : []
  ).filter((seg) => seg.chord !== null || seg.alternatives.length > 0);
  return (
    <>
      <p className={styles.heard}>What we heard in bar {cell.bar + 1}</p>
      {groups.map((seg) => {
        // The current chord first, then alternatives; a picked alternative is now current, so dedupe.
        const choices = [seg.chord, ...seg.alternatives]
          .filter((c): c is ChordLabel => c !== null)
          .filter(
            (c, i, all) =>
              all.findIndex((o) => chordName(o) === chordName(c)) === i,
          );
        return (
          <div key={seg.index} className={styles.group}>
            {groups.length > 1 && (
              <p className={styles.groupLabel}>
                Beats {seg.beat + 1}
                {seg === groups[groups.length - 1]
                  ? ''
                  : `–${groups[groups.indexOf(seg) + 1].beat}`}
                {seg === groups[groups.length - 1] ? ' on' : ''}
              </p>
            )}
            {choices.map((c, rank) => (
              <button
                key={chordName(c)}
                type="button"
                className={styles.option}
                aria-label={
                  rank === 0
                    ? `${chordName(c)}, ${edited.includes(seg.index) ? 'your choice' : 'as heard'}`
                    : chordName(c)
                }
                onClick={() => onPick(seg, c)}
              >
                <b>{chordName(c)}</b>
                <span className={styles.rank} aria-hidden="true">
                  <span style={{ width: `${RANK_WIDTH[rank] ?? 20}%` }} />
                </span>
                <span className={styles.tag} aria-hidden="true">
                  {rank === 0
                    ? edited.includes(seg.index)
                      ? 'yours'
                      : 'heard'
                    : ''}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

export default function Review() {
  const [burst, setBurst] = useState<{ bar: number; key: number } | null>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const hydrated = useSong((s) => s.hydrated);
  const meta = useSong((s) => s.meta);
  const analysis = useSong((s) => s.analysis);
  const edits = useSong((s) => s.edits);
  const file = useSong((s) => s.file);
  const [page, setPage] = useState(0);
  const player = useBarPlayer(file);

  useEffect(() => {
    if (!hydrated) return;
    if (!meta) routerRef.current.replace('/');
    else if (!analysis) routerRef.current.replace('/listen');
  }, [hydrated, meta, analysis]);

  const effective = useMemo(
    () => (analysis ? effectiveAnalysis(analysis, edits) : null),
    [analysis, edits],
  );
  const bars = useMemo(() => (effective ? toBars(effective) : []), [effective]);
  const heard = analysis ? detectedMood(analysis) : undefined;
  const moodValues = analysis ? effectiveMood(analysis, edits) : undefined;
  const mood = moodValues ? moodLabelOf(moodValues) : undefined;
  const spans = useMemo(
    () => (effective ? barSpans(effective, bars.length) : []),
    [effective, bars.length],
  );
  const sections = useMemo(
    () =>
      findSections(bars.map((cell) => chordsOf(cell).map(displayName).join(' · '))),
    [bars],
  );
  // Letters only help when something repeats.
  const lettered = hasRepeats(sections);

  // A new meter regroups the beats: the bar that was playing is a different stretch now.
  const beatsPerBar = effective?.meter.beatsPerBar;
  const stopPlayer = player.stop;
  useEffect(() => stopPlayer(), [beatsPerBar, stopPlayer]);

  if (!effective || !analysis) return null;

  const isLow = (seg: BarSegment) =>
    seg.confidence < LOW_CONFIDENCE && !edits.confirmed.includes(seg.index);
  const statusOf = (cell: BarCell): ChordBlockStatus =>
    cell.segments.some(isLow)
      ? 'low'
      : cell.segments.some((s) => edits.confirmed.includes(s.index))
        ? 'confirmed'
        : 'normal';
  const toCheck = analysis.chords.filter(
    (c, i) => c.confidence < LOW_CONFIDENCE && !edits.confirmed.includes(i),
  ).length;

  const pages = Math.max(1, Math.ceil(bars.length / PAGE));
  const shown = bars.slice(page * PAGE, page * PAGE + PAGE);
  const first = page * PAGE + 1;
  const last = page * PAGE + shown.length;
  const from = spans[first - 1];
  const to = spans[last - 1];

  return (
    <AppShell actions={<Stepper steps={STEPS} current={2} align="end" />}>
      <div className={styles.layout}>
        <main className={styles.main}>
          <h1>Check the chords</h1>
          <p className={styles.hint}>
            We’re confident about most of these. Tap a chord with an orange ring
            to pick a better match.
          </p>

          {/* DESIGN-REVIEW: motion.md morphs each chord block into its label on the sheet; the
              tab's labels are SVG text, which can't take part, so the grid card morphs into the tab card. */}
          <ViewTransition name="chords-card">
            <Card padding="md" className={styles.gridCard}>
              <div className={styles.gridHead}>
                <b>
                  Bars {first} to {last}
                  {from && to
                    ? ` · ${formatClock(from.start)}–${formatClock(to.end)}`
                    : ''}
                </b>
                <span className={styles.count} aria-live="polite">
                  {toCheck
                    ? `${toCheck} chord${toCheck > 1 ? 's' : ''} to check`
                    : 'All chords checked'}
                </span>
              </div>
              {lettered && (
                <p className={styles.sectionsHint}>
                  Letters mark runs of chords that repeat, so you can spot the
                  verse and the chorus.
                </p>
              )}
              <ul className={styles.grid}>
                {shown.map((cell) => {
                  const chords = chordsOf(cell);
                  const span = spans[cell.bar];
                  const section = sections[cell.bar];
                  return (
                    <li key={cell.bar} className={styles.cell}>
                      {burst?.bar === cell.bar && (
                        // Chord confirmed (moment #4): decorative, over the block.
                        <LottieMoment
                          src={LOTTIE.chordConfirmed}
                          playKey={burst.key}
                          width={96}
                          height={96}
                          className={styles.burst}
                          fallback={null}
                          onComplete={() => setBurst(null)}
                        />
                      )}
                      <Popover
                        label={`Pick a chord for bar ${cell.bar + 1}`}
                        trigger={({ ref, ...props }) => (
                          <ChordBlock
                            ref={ref as (el: HTMLButtonElement | null) => void}
                            {...props}
                            bar={cell.bar + 1}
                            chord={chords.map(displayName).join(' · ')}
                            spoken={chords.map(spokenName).join(' · ')}
                            status={statusOf(cell)}
                            open={props['aria-expanded']}
                            time={span ? formatClock(span.start) : undefined}
                            section={
                              lettered && section?.starts
                                ? section.letter
                                : undefined
                            }
                            onPlay={
                              file && span
                                ? () =>
                                    void player.toggle(
                                      cell.bar,
                                      span.start,
                                      span.end,
                                    )
                                : undefined
                            }
                            playing={player.playing === cell.bar}
                          />
                        )}
                      >
                        {({ close }) => (
                          <Options
                            cell={cell}
                            edited={edits.confirmed}
                            onPick={(seg, chord) => {
                              songStore.getState().setChord(seg.index, chord);
                              setBurst((b) => ({
                                bar: cell.bar,
                                key: (b?.key ?? 0) + 1,
                              }));
                              close();
                            }}
                          />
                        )}
                      </Popover>
                    </li>
                  );
                })}
              </ul>
              {pages > 1 && (
                <div className={styles.pager}>
                  <Button
                    variant="ghost"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous bars
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={page === pages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    Next bars
                  </Button>
                </div>
              )}
            </Card>
          </ViewTransition>
        </main>

        <aside className={styles.side}>
          <Card padding="md" className={styles.facts}>
            <div className={styles.fact}>
              <span>Tempo</span>
              <b>{Math.round(analysis.bpm)} bpm</b>
            </div>
            <div className={styles.fact}>
              <span>Key</span>
              <b>
                {KEYS[analysis.key.pc]} {analysis.key.mode}
              </b>
            </div>
            <div className={styles.time}>
              <span id="time-label">Time</span>
              <SegmentedControl
                label="Time"
                tone="secondary"
                fullWidth
                options={METERS}
                value={String(effective.meter.beatsPerBar) as '4' | '3'}
                onChange={(v) =>
                  songStore.getState().setMeter(Number(v) as 3 | 4)
                }
              />
            </div>
            {mood ? (
              <div className={styles.time}>
                <span id="mood-label">Mood</span>
                <SegmentedControl
                  label="Mood"
                  tone="secondary"
                  fullWidth
                  options={MOOD_OPTIONS}
                  value={mood}
                  onChange={(v) => songStore.getState().setMood(presetValues(v))}
                />
                {heard && (
                  <span className={styles.heardMood}>
                    {heard === mood
                      ? 'This is how it sounded to us. It sets the pattern and the touch.'
                      : `It sounded ${moodName(heard).toLowerCase()} to us.`}
                  </span>
                )}
              </div>
            ) : (
              // Songs read before moods and tunes (M9, M10): say so where the mood would be.
              <div className={styles.time}>
                <span>Mood</span>
                <span className={styles.heardMood}>
                  This song was read before Thumbline could hear its mood and
                  follow its tune. Your chord changes will be cleared.
                </span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    songStore.getState().relisten();
                    router.push('/listen');
                  }}
                >
                  Listen again
                </Button>
              </div>
            )}
          </Card>
          <Button size="lg" onClick={() => router.push('/sheet')}>
            Looks good, write my sheets
          </Button>
          <p className={styles.note}>
            You can come back and change chords any time.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
