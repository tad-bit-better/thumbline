import type { ChordLabel, ChordSegment, Quality } from './types.js';

/** One detected beat: its chroma (12 bins, C = 0) and RMS level. */
export type BeatFeatures = { chroma: ArrayLike<number>; energy: number };

/** Chord vocabulary we detect: intervals with template weights, and a prior favouring triads. */
const QUALITIES: Array<{ quality: Quality; tones: Array<[number, number]>; prior: number }> = [
  { quality: 'maj', tones: [[0, 1], [4, 0.85], [7, 0.85]], prior: 0 },
  { quality: 'm', tones: [[0, 1], [3, 0.85], [7, 0.85]], prior: 0 },
  { quality: '7', tones: [[0, 1], [4, 0.85], [7, 0.85], [10, 0.75]], prior: -0.03 },
  { quality: 'm7', tones: [[0, 1], [3, 0.85], [7, 0.85], [10, 0.75]], prior: -0.03 },
  { quality: 'maj7', tones: [[0, 1], [4, 0.85], [7, 0.85], [11, 0.75]], prior: -0.035 },
  { quality: 'sus4', tones: [[0, 1], [5, 0.85], [7, 0.85]], prior: -0.04 },
  { quality: 'sus2', tones: [[0, 1], [2, 0.85], [7, 0.85]], prior: -0.05 },
  { quality: 'dim', tones: [[0, 1], [3, 0.85], [6, 0.85]], prior: -0.05 },
];

/** Chords that read as the same choice on the Review screen (C, C7, Cmaj7…). */
const FAMILY: Record<Quality, string> = { maj: 'maj', '7': 'maj', maj7: 'maj', '6': 'maj', add9: 'maj', m: 'min', m7: 'min', sus2: 'sus', sus4: 'sus', dim: 'dim' };

type Template = { label: ChordLabel; key: string; group: string; weights: Float64Array; prior: number };

const TEMPLATES: Template[] = [];
for (let pc = 0; pc < 12; pc++) {
  for (const q of QUALITIES) {
    const weights = new Float64Array(12);
    for (const [iv, w] of q.tones) weights[(pc + iv) % 12] = w;
    const norm = Math.hypot(...weights);
    for (let i = 0; i < 12; i++) weights[i] /= norm;
    TEMPLATES.push({ label: { pc, quality: q.quality }, key: `${pc}:${q.quality}`, group: `${pc}:${FAMILY[q.quality]}`, weights, prior: q.prior });
  }
}

const CHANGE_MARGIN_PER_BEAT = 0.06;
const CONFIDENCE_SCALE = 0.3;
const SILENCE_RATIO = 0.03;
const METER_MIN_SALIENCE = 0.02;
const THREE_FOUR_BIAS = 1.2;

function scores(chroma: ArrayLike<number>): Float64Array {
  const norm = Math.hypot(...Array.from(chroma)) || 1;
  const out = new Float64Array(TEMPLATES.length);
  TEMPLATES.forEach((t, k) => {
    let dot = 0;
    for (let i = 0; i < 12; i++) dot += (chroma[i] / norm) * t.weights[i];
    out[k] = dot + t.prior;
  });
  return out;
}

/** Every chord in the vocabulary scored against a chroma, best first. */
export function rankChords(chroma: ArrayLike<number>): Array<{ label: ChordLabel; score: number }> {
  const s = scores(chroma);
  return TEMPLATES.map((t, k) => ({ label: t.label, score: s[k] })).sort((a, b) => b.score - a.score);
}

function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 1;
}

/**
 * Meter and downbeat from where the harmony changes: chord changes cluster
 * on bar lines. Defaults to 4/4 from the first beat when it can't tell.
 */
export function detectMeter(beats: readonly BeatFeatures[]): { beatsPerBar: 3 | 4; firstDownbeat: number } {
  const novelty = beats.map((b, i) => (i === 0 ? 0 : 1 - cosine(b.chroma, beats[i - 1].chroma)));
  const all = novelty.slice(1);
  const mean = all.reduce((s, v) => s + v, 0) / (all.length || 1);
  const best = (period: number) => {
    let top = { phase: 0, salience: -Infinity };
    for (let phase = 0; phase < period; phase++) {
      const at = novelty.filter((_, i) => i >= 1 && i % period === phase);
      const salience = at.reduce((s, v) => s + v, 0) / (at.length || 1) - mean;
      if (salience > top.salience) top = { phase, salience };
    }
    return top;
  };
  const four = best(4);
  const three = best(3);
  if (Math.max(four.salience, three.salience) < METER_MIN_SALIENCE) return { beatsPerBar: 4, firstDownbeat: 0 };
  if (three.salience > four.salience * THREE_FOUR_BIAS) return { beatsPerBar: 3, firstDownbeat: three.phase };
  return { beatsPerBar: 4, firstDownbeat: four.phase };
}

type Open = { bar: number; beat: number; key: string | null; sums: Float64Array; beats: number };

function close(seg: Open): ChordSegment {
  if (seg.key === null) return { bar: seg.bar, beat: seg.beat, chord: null, confidence: 1, alternatives: [] };
  const chosen = TEMPLATES.find((t) => t.key === seg.key) as Template;
  const ranked = TEMPLATES.map((t, k) => ({ t, s: seg.sums[k] })).sort((a, b) => b.s - a.s);
  const rival = ranked.find((r) => r.t.group !== chosen.group);
  const chosenSum = seg.sums[TEMPLATES.indexOf(chosen)];
  const margin = rival ? (chosenSum - rival.s) / seg.beats : 1;
  const seen = new Set([chosen.group]);
  const alternatives: ChordLabel[] = [];
  for (const r of ranked) {
    if (alternatives.length === 3) break;
    if (seen.has(r.t.group)) continue;
    seen.add(r.t.group);
    alternatives.push(r.t.label);
  }
  return {
    bar: seg.bar,
    beat: seg.beat,
    chord: chosen.label,
    confidence: Math.min(1, Math.max(0, margin / CONFIDENCE_SCALE)),
    alternatives,
  };
}

/**
 * Snap per-beat chroma to bars: one chord per bar, or two in 4/4 when the
 * second half clearly changes. Consecutive equal chords merge; quiet
 * stretches become `null`. Beats before the first downbeat are dropped.
 */
export function toSegments(beats: readonly BeatFeatures[], beatsPerBar: number, firstDownbeat: number): ChordSegment[] {
  const perBeat = beats.map((b) => scores(b.chroma));
  const loud = Math.max(...beats.map((b) => b.energy), 0);
  const slotsPerBar = beatsPerBar === 4 ? 2 : 1;
  const slotLen = beatsPerBar / slotsPerBar;
  const out: ChordSegment[] = [];
  let open: Open | null = null;

  for (let start = firstDownbeat, bar = 0; start < beats.length; start += beatsPerBar, bar++) {
    for (let slot = 0; slot < slotsPerBar; slot++) {
      const from = start + slot * slotLen;
      const to = Math.min(beats.length, from + slotLen);
      if (from >= to) break;
      const sums = new Float64Array(TEMPLATES.length);
      let energy = 0;
      for (let b = from; b < to; b++) {
        energy += beats[b].energy / (to - from);
        for (let k = 0; k < sums.length; k++) sums[k] += perBeat[b][k];
      }
      let key: string | null;
      if (energy < loud * SILENCE_RATIO) key = null;
      else {
        let top = 0;
        for (let k = 1; k < sums.length; k++) if (sums[k] > sums[top]) top = k;
        key = TEMPLATES[top].key;
        // Inside a bar, only change on a clear win; a passing note shouldn't split it.
        if (slot > 0 && open && open.key !== null && key !== open.key) {
          const current = TEMPLATES.findIndex((t) => t.key === open?.key);
          if (sums[top] - sums[current] < CHANGE_MARGIN_PER_BEAT * (to - from)) key = open.key;
        }
      }
      if (!open || key !== open.key) {
        if (open) out.push(close(open));
        open = { bar, beat: slot * slotLen, key, sums: new Float64Array(TEMPLATES.length), beats: 0 };
      }
      for (let k = 0; k < sums.length; k++) open.sums[k] += sums[k];
      open.beats += to - from;
    }
  }
  if (open) out.push(close(open));
  return out;
}

/** Fill in beats the tracker missed before the music's first detected beat. */
export function extendBeats(times: readonly number[]): number[] {
  if (times.length < 2) return [...times];
  const intervals = times.slice(1, 9).map((t, i) => t - times[i]).sort((a, b) => a - b);
  const step = intervals[Math.floor(intervals.length / 2)];
  const before: number[] = [];
  for (let t = times[0] - step; t >= -1e-9; t -= step) before.unshift(Math.max(0, t));
  return [...before, ...times];
}
