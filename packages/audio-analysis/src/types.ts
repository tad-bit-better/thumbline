// AnalysisResult contract from docs/engine-spec.md §1. audio-analysis depends on
// nothing in the repo (PLAN §3), so it declares the shape here; the app hands it
// to the engine, and TypeScript checks the two match there.

export type Quality = 'maj' | 'm' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | 'dim' | 'add9' | '6';

export type ChordLabel = { pc: number; quality: Quality; bassPc?: number };

export type ChordSegment = {
  bar: number;
  beat: number;
  chord: ChordLabel | null;
  confidence: number;
  alternatives: ChordLabel[];
};

export type AnalysisResult = {
  version: 1;
  durationSec: number;
  bpm: number;
  beatTimesSec: number[];
  barStartBeat: number;
  meter: { beatsPerBar: 3 | 4 | 12; accents?: number[] };
  key: { pc: number; mode: 'major' | 'minor' | 'phrygian' };
  chords: ChordSegment[];
  melody?: MelodyNote[];
};

export type MelodyNote = { startSec: number; durSec: number; midi: number; confidence: number };
