import type { AnalysisResult, ChordLabel } from '@thumbline/engine';
import { useMemo, useState } from 'react';
import { barSpans, chordFlags, toBars } from '../../lib/bars';
import { songStore } from '../../lib/song-store';
import { useBarPlayer } from '../../lib/use-bar-player';
import { barStatus } from './bar-chords';

/**
 * Checking chords on the sheet: the bars and where they sit in the clip, the
 * chords we're unsure of, the bar player behind "Hear this bar", opening a
 * bar's picker (and the next one to check), and a pick with its burst (#4).
 */
export function useChordChecking(
  effective: AnalysisResult | null,
  confirmed: readonly number[],
  file: Blob | null,
  reduced: boolean,
) {
  const bars = useMemo(() => (effective ? toBars(effective) : []), [effective]);
  const spans = useMemo(
    () => (effective ? barSpans(effective, bars.length) : []),
    [effective, bars.length],
  );
  const flags = useMemo(
    () => (effective ? chordFlags(effective, confirmed) : new Map()),
    [effective, confirmed],
  );
  const flaggedBars = useMemo(
    () =>
      bars
        .filter((c) =>
          ['check', 'likely'].includes(barStatus(c, flags, confirmed)),
        )
        .map((c) => c.bar),
    [bars, flags, confirmed],
  );
  const barPlayer = useBarPlayer(file);
  const [burst, setBurst] = useState<{ bar: number; key: number } | null>(null);

  /** Open a bar's chord picker, bringing its card into view. */
  const openChord = (bar: number) => {
    const chip = document.querySelector<HTMLButtonElement>(
      `[data-chord-bar="${bar}"]`,
    );
    chip?.scrollIntoView?.({
      block: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    });
    chip?.click();
  };
  /** The next flagged bar after `bar` (wrapping round), other than it. */
  const nextFlagged = (bar: number) =>
    flaggedBars.find((b) => b > bar) ?? flaggedBars.find((b) => b !== bar);
  const pickChord = (bar: number, segment: number, chord: ChordLabel) => {
    songStore.getState().setChord(segment, chord);
    setBurst((b) => ({ bar, key: (b?.key ?? 0) + 1 }));
  };

  return {
    bars,
    spans,
    flags,
    flaggedBars,
    barPlayer,
    burst,
    openChord,
    nextFlagged,
    pickChord,
  };
}
