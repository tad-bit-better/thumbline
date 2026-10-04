import type { AnalysisResult, ChordLabel } from '@thumbline/engine';

/**
 * Below this confidence a chord is flagged on the Review screen. From the
 * synthetic eval: ~25% of chords flagged, catching ~45% of the wrong ones;
 * a flagged chord is wrong about half the time (base rate ~28%).
 */
export const LOW_CONFIDENCE = 0.12;

export type BarSegment = {
  /** Index into analysis.chords (what edits are keyed by). */
  index: number;
  beat: number;
  chord: ChordLabel | null;
  confidence: number;
  alternatives: ChordLabel[];
};

export type BarCell = {
  bar: number;
  /** Segments starting in this bar; empty when the previous chord carries on. */
  segments: BarSegment[];
  /** The segment sounding at the downbeat (carried in when `segments` is empty). */
  sounding: BarSegment | null;
};

/** Group chord segments into bars for the Review grid. */
export function toBars(analysis: AnalysisResult): BarCell[] {
  const bpb = analysis.meter.beatsPerBar;
  const fromBeats = Math.floor((analysis.beatTimesSec.length - analysis.barStartBeat) / bpb);
  const fromChords = analysis.chords.reduce((m, c) => Math.max(m, c.bar + 1), 0);
  const count = Math.max(fromBeats, fromChords);
  const cells: BarCell[] = Array.from({ length: count }, (_, bar) => ({ bar, segments: [], sounding: null }));
  analysis.chords.forEach((c, index) => {
    cells[c.bar]?.segments.push({ index, beat: c.beat, chord: c.chord, confidence: c.confidence, alternatives: c.alternatives });
  });
  let carried: BarSegment | null = null;
  for (const cell of cells) {
    const first = cell.segments[0];
    cell.sounding = first && first.beat === 0 ? first : carried;
    if (cell.segments.length) carried = cell.segments[cell.segments.length - 1];
  }
  return cells;
}
