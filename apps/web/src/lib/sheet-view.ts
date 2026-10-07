// What the Sheet screen shows about a song (screens.md §4, Sheet v2), as plain functions.
import { type AnalysisResult, type Arrangement, chordName } from '@thumbline/engine';
import type { TabSection } from '@thumbline/tab-renderer';
import { toBars } from './bars';
import { findSections, hasRepeats } from './sections';

/** A section of the sheet; `letter` when sections repeat (A, B, A…), so a setting can follow every repeat. */
export type SongSection = TabSection & { letter?: string };

/** The song's name from its file: no extension, underscores as spaces, a site's "(mp3.pm)" tag dropped. */
export function songTitle(fileName: string): string {
  const name = fileName
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s*\([^)]*\.[a-z]{2,4}\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name || fileName;
}

/**
 * The song's sections for the tab: runs of bars that repeat the same chords get the same letter
 * (Section A, B, A…), each with its bar range. Without repeats, plain parts of 8 (or 4) bars.
 * From the song's chords (not the arrangement), so per-section settings can shape the arrangement.
 */
export function sheetSections(a: AnalysisResult): SongSection[] {
  const cells = toBars(a);
  const labels = cells.map((cell) =>
    (cell.segments.length ? cell.segments : cell.sounding ? [cell.sounding] : []).map((s) => (s.chord ? chordName(s.chord) : '-')).join(' '),
  );
  const bars = findSections(labels);
  const lettered = hasRepeats(bars);
  const out: SongSection[] = [];
  bars.forEach((b, bar) => {
    if (!b.starts) return;
    const last = out.at(-1);
    if (last) last.bars = bar - last.firstBar;
    out.push({
      id: String(bar),
      title: lettered ? `Section ${b.letter}` : `Part ${out.length + 1}`,
      ...(lettered ? { letter: b.letter } : {}),
      firstBar: bar,
      bars: cells.length - bar,
    });
  });
  return out.map((s) => ({ ...s, detail: s.bars > 1 ? `Bars ${s.firstBar + 1}–${s.firstBar + s.bars}` : `Bar ${s.firstBar + 1}` }));
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * One line for the sheet's warnings: "3 chords are simplified and 2 need a barre." Undefined when
 * there is nothing to say.
 */
export function warningSummary(warnings: Arrangement['warnings']): string | undefined {
  const count = (code: string) => warnings.filter((w) => w.code === code).length;
  const parts = [
    [count('simplified'), (n: number) => `${n} ${plural(n, 'chord is', 'chords are')} simplified`],
    [count('barre'), (n: number) => `${n} ${plural(n, 'chord needs', 'chords need')} a barre`],
    [count('unsupported-chord'), (n: number) => `${n} ${plural(n, 'chord is', 'chords are')} played as a nearby chord`],
    [count('slash-dropped'), (n: number) => `${n} ${plural(n, 'chord plays', 'chords play')} without the separate bass note`],
  ] as const;
  const said = parts.filter(([n]) => n > 0).map(([n, text]) => text(n));
  if (!said.length) return undefined;
  const line = said.length === 1 ? said[0] : `${said.slice(0, -1).join(', ')} and ${said.at(-1)}`;
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}
