import type { AnalysisResult, ChordLabel } from '@thumbline/engine';

/** Share of a song's chords flagged on the sheet, the least sure first. */
const FLAG_SHARE = 0.12;
/** Never flag a chord this sure or surer, however it ranks (a clean song has nothing to check). */
const FLAG_CEILING = 0.35;

export type ChordFlag = 'check' | 'likely';

/**
 * Which chords the sheet marks (by index into analysis.chords): the least sure
 * 12% of the song's chords (rounded up), only those under 0.35 confidence,
 * leaving out chords the reader chose (`confirmed`) and silences. The lowest
 * third of those (rounded up) are likely off; the rest might be. Ranked, not a
 * fixed cut: confidence runs low on some songs (~0.17 on old film songs), so a
 * fixed cut would flag half of them.
 */
export function chordFlags(analysis: AnalysisResult, confirmed: readonly number[]): Map<number, ChordFlag> {
  const chords = analysis.chords.flatMap((c, index) => (c.chord ? [{ index, confidence: c.confidence }] : []));
  const quota = Math.ceil(chords.length * FLAG_SHARE);
  const flagged = chords
    .filter((c) => !confirmed.includes(c.index) && c.confidence < FLAG_CEILING)
    .sort((a, b) => a.confidence - b.confidence || a.index - b.index)
    .slice(0, quota);
  const likely = new Set(flagged.slice(0, Math.ceil(flagged.length / 3)).map((c) => c.index));
  return new Map(
    flagged
      .map((c) => c.index)
      .sort((a, b) => a - b)
      .map((index): [number, ChordFlag] => [index, likely.has(index) ? 'likely' : 'check']),
  );
}

export type BarSegment = {
  /** Index into analysis.chords (what edits are keyed by). */
  index: number;
  /** The bar it starts in (an earlier one when carried in). */
  bar: number;
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

/** Group chord segments into bars (the sheet's chord pickers). */
export function toBars(analysis: AnalysisResult): BarCell[] {
  const bpb = analysis.meter.beatsPerBar;
  const fromBeats = Math.floor((analysis.beatTimesSec.length - analysis.barStartBeat) / bpb);
  const fromChords = analysis.chords.reduce((m, c) => Math.max(m, c.bar + 1), 0);
  const count = Math.max(fromBeats, fromChords);
  const cells: BarCell[] = Array.from({ length: count }, (_, bar) => ({ bar, segments: [], sounding: null }));
  analysis.chords.forEach((c, index) => {
    cells[c.bar]?.segments.push({ index, bar: c.bar, beat: c.beat, chord: c.chord, confidence: c.confidence, alternatives: c.alternatives });
  });
  let carried: BarSegment | null = null;
  for (const cell of cells) {
    const first = cell.segments[0];
    cell.sounding = first && first.beat === 0 ? first : carried;
    if (cell.segments.length) carried = cell.segments[cell.segments.length - 1];
  }
  return cells;
}

/** Where a bar sits in the clip, in seconds. */
export type BarSpan = { start: number; end: number };

/**
 * Start and end of each of the first `count` bars, from the detected beats
 * (so a song that speeds up or slows down still lines up). Bars past the last
 * detected beat carry on at the song's tempo; nothing goes past the clip's end.
 */
export function barSpans(analysis: AnalysisResult, count: number): BarSpan[] {
  const beats = analysis.beatTimesSec;
  const period = analysis.bpm > 0 ? 60 / analysis.bpm : 0.5;
  const last = beats.length - 1;
  const beatAt = (i: number) =>
    last < 0 ? i * period : i <= last ? beats[Math.max(0, i)] : beats[last] + (i - last) * period;
  const clamp = (t: number) => Math.min(Math.max(0, t), analysis.durationSec);
  const bpb = analysis.meter.beatsPerBar;
  return Array.from({ length: count }, (_, bar) => {
    const first = analysis.barStartBeat + bar * bpb;
    return { start: clamp(beatAt(first)), end: clamp(beatAt(first + bpb)) };
  });
}
