'use client';

import { type AnalysisResult, type ChordLabel, type Quality, chordName } from '@thumbline/engine';
import { type ChordChipStatus, ChordChip, ChordPicker, LottieMoment, Popover } from '@thumbline/ui';
import { type ReactNode, useState } from 'react';
import type { BarCell, BarSegment, ChordFlag } from '../../lib/bars';
import { LOTTIE } from '../../lib/lottie';
import styles from './sheet.module.css';

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALITIES: ReadonlyArray<{ value: Quality; label: string }> = [
  { value: 'maj', label: 'Major' },
  { value: 'm', label: 'Minor' },
  { value: '7', label: '7' },
  { value: 'm7', label: 'm7' },
  { value: 'maj7', label: 'maj7' },
  { value: 'sus2', label: 'sus2' },
  { value: 'sus4', label: 'sus4' },
  { value: 'dim', label: 'dim' },
];
// DESIGN-REVIEW: AnalysisResult ranks alternatives without scores, so the bars show rank, not invented percentages.
const RANK_STRENGTH = [1, 0.62, 0.4, 0.26];

export type BarChordsProps = {
  cell: BarCell;
  /** The analysis as heard (before the reader's changes): what we suggest. */
  heard: AnalysisResult;
  /** Segment indexes the reader chose. */
  confirmed: readonly number[];
  flags: ReadonlyMap<number, ChordFlag>;
  /** The chord names as the card draws them. */
  children: ReactNode;
  onPick: (segment: number, chord: ChordLabel) => void;
  /** Hear this bar of the original; absent without the clip. */
  onHear?: () => void;
  hearing: boolean;
  /** Open the next flagged chord; absent when none is left. */
  onNext?: () => void;
  nextLabel?: string;
  /** Bumped when a chord in this bar was just chosen: plays Chord confirmed (#4). */
  burstKey?: number;
};

/** The segments a bar's picker edits: those starting in it, or the one carried in. */
const segmentsOf = (cell: BarCell): BarSegment[] =>
  (cell.segments.length ? cell.segments : cell.sounding ? [cell.sounding] : []).filter((s) => s.chord !== null || s.alternatives.length > 0);

/** The chip's mark: the reader's choice, else the worst flag among the bar's chords. */
export function barStatus(cell: BarCell, flags: ReadonlyMap<number, ChordFlag>, confirmed: readonly number[]): ChordChipStatus {
  if (cell.segments.some((s) => confirmed.includes(s.index))) return 'yours';
  const marks = cell.segments.map((s) => flags.get(s.index));
  return marks.includes('likely') ? 'likely' : marks.includes('check') ? 'check' : 'none';
}

/**
 * A bar card's chord names as a button that opens the bar's chord picker:
 * what we heard and our other guesses, "Something else", hear the bar, and
 * on to the next chord to check. Picks are kept as the reader's edits.
 */
export function BarChords({ cell, heard, confirmed, flags, children, onPick, onHear, hearing, onNext, nextLabel, burstKey }: BarChordsProps) {
  const [open, setOpen] = useState(false);
  const segments = segmentsOf(cell);
  const bar = cell.bar + 1;
  const status = barStatus(cell, flags, confirmed);
  const spoken = segments.map((s) => (s.chord ? chordName(s.chord) : 'no chord')).join(' then ') || 'no chord';

  const groups = segments.map((seg, k) => {
    const raw = heard.chords[seg.index];
    const ours = [raw?.chord ?? null, ...(raw?.alternatives ?? [])].filter((c): c is ChordLabel => c !== null);
    const mine = confirmed.includes(seg.index) && seg.chord ? seg.chord : null;
    const all = [...(mine && !ours.some((c) => chordName(c) === chordName(mine)) ? [mine] : []), ...ours];
    const unique = all.filter((c, i) => all.findIndex((o) => chordName(o) === chordName(c)) === i);
    const next = segments[k + 1];
    const label =
      seg.bar !== cell.bar
        ? `Carried on from bar ${seg.bar + 1}`
        : segments.length > 1
          ? `Beats ${seg.beat + 1}${next ? `–${next.beat}` : ' on'}`
          : undefined;
    return {
      id: String(seg.index),
      label,
      choices: unique.map((c) => ({
        id: chordName(c),
        name: chordName(c),
        tag: mine && chordName(c) === chordName(mine) ? ('yours' as const) : raw?.chord && chordName(c) === chordName(raw.chord) ? ('heard' as const) : undefined,
        strength: RANK_STRENGTH[Math.max(0, ours.findIndex((o) => chordName(o) === chordName(c)))] ?? 0.2,
      })),
      byName: new Map(unique.map((c) => [chordName(c), c])),
    };
  });

  return (
    <span className={styles.barChords}>
      {burstKey !== undefined && (
        // Chord confirmed (moment #4): decorative, over the chord.
        <LottieMoment src={LOTTIE.chordConfirmed} playKey={burstKey} width={72} height={72} className={styles.chordBurst} fallback={null} />
      )}
      <Popover
        label={`Chord for bar ${bar}`}
        onOpenChange={setOpen}
        trigger={({ ref, ...props }) => (
          <ChordChip ref={ref as (el: HTMLButtonElement | null) => void} {...props} bar={bar} spoken={spoken} status={status} data-chord-bar={cell.bar}>
            {children}
          </ChordChip>
        )}
      >
        {({ close }) =>
          open && (
            <ChordPicker
              title={`Bar ${bar}`}
              groups={groups.map(({ byName: _byName, ...g }) => g)}
              onPick={(groupId, name) => {
                const chord = groups.find((g) => g.id === groupId)?.byName.get(name);
                if (chord) onPick(Number(groupId), chord);
                close();
              }}
              other={{
                roots: ROOTS,
                qualities: QUALITIES,
                nameOf: (root, quality) => chordName({ pc: root, quality: quality as Quality }),
                onPick: (groupId, root, quality) => {
                  onPick(Number(groupId), { pc: root, quality: quality as Quality });
                  close();
                },
              }}
              onHear={onHear}
              hearing={hearing}
              onNext={
                onNext &&
                (() => {
                  close();
                  onNext();
                })
              }
              nextLabel={nextLabel}
            />
          )
        }
      </Popover>
    </span>
  );
}
