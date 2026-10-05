import type { ChordLabel, ChordSegment, Quality } from './types.js';

/**
 * One detected beat: chroma (12 bins, C = 0) of the mix, of its bass band
 * and of the stereo side signal (if any), and the RMS level.
 */
export type BeatFeatures = { chroma: ArrayLike<number>; energy: number; bass?: ArrayLike<number>; side?: ArrayLike<number> };

/** Chord vocabulary we detect: intervals with template weights, and a prior favouring triads. */
const QUALITIES: Array<{ quality: Quality; tones: Array<[number, number]>; prior: number }> = [
  { quality: 'maj', tones: [[0, 1], [4, 0.85], [7, 0.85]], prior: 0 },
  { quality: 'm', tones: [[0, 1], [3, 0.85], [7, 0.85]], prior: 0 },
  { quality: '7', tones: [[0, 1], [4, 0.85], [7, 0.85], [10, 0.75]], prior: -0.045 },
  { quality: 'm7', tones: [[0, 1], [3, 0.85], [7, 0.85], [10, 0.75]], prior: -0.045 },
  { quality: 'maj7', tones: [[0, 1], [4, 0.85], [7, 0.85], [11, 0.75]], prior: -0.045 },
  { quality: 'sus4', tones: [[0, 1], [5, 0.85], [7, 0.85]], prior: -0.06 },
  { quality: 'sus2', tones: [[0, 1], [2, 0.85], [7, 0.85]], prior: -0.075 },
  { quality: 'dim', tones: [[0, 1], [3, 0.85], [6, 0.85]], prior: -0.075 },
];

/** Chords that read as the same choice on the Review screen (C, C7, Cmaj7…). */
const FAMILY: Record<Quality, string> = { maj: 'maj', '7': 'maj', maj7: 'maj', '6': 'maj', add9: 'maj', m: 'min', m7: 'min', sus2: 'sus', sus4: 'sus', dim: 'dim' };

type Template = { label: ChordLabel; key: string; group: string; weights: Float64Array; prior: number; tones: number[] };

/**
 * Plucked strings ring with strong overtones: harmonic k of a note lands k
 * semitone-steps up the series (octave, fifth, octave, major third, fifth).
 * Templates include them, so a minor chord's own overtones (the root's 5th
 * harmonic is its major third) don't make it look major.
 */
const HARMONIC_INTERVALS = [0, 0, 7, 0, 4, 7];
/** Tuned on the eval (0.4–0.8 tried; 0.6 best). */
const HARMONIC_DECAY = 0.6;

const TEMPLATES: Template[] = [];
for (let pc = 0; pc < 12; pc++) {
  for (const q of QUALITIES) {
    const weights = new Float64Array(12);
    for (const [iv, w] of q.tones) {
      HARMONIC_INTERVALS.forEach((h, k) => {
        weights[(pc + iv + h) % 12] += w * HARMONIC_DECAY ** k;
      });
    }
    const norm = Math.hypot(...weights);
    for (let i = 0; i < 12; i++) weights[i] /= norm;
    TEMPLATES.push({
      label: { pc, quality: q.quality },
      key: `${pc}:${q.quality}`,
      group: `${pc}:${FAMILY[q.quality]}`,
      weights,
      prior: q.prior,
      tones: q.tones.map(([iv]) => (pc + iv) % 12),
    });
  }
}

/** What a chord change costs on a bar line, in summed per-beat score. */
const CHANGE_COST = 0.12;
/** A change inside a bar costs this many times more. */
const MID_BAR_CHANGE = 2;
/** Per beat, for a chord whose tones are all in the song's key. */
const KEY_BONUS_PER_BEAT = 0.02;
const CONFIDENCE_SCALE = 0.3;
const SILENCE_RATIO = 0.03;
const METER_MIN_SALIENCE = 0.02;
const THREE_FOUR_BIAS = 1.2;
/** Share of the side signal's chroma in the harmony chroma, when stereo. */
const SIDE_MIX = 0.6;
/** Bonus for the share of bass-band energy on the chord's root and other tones. */
const BASS_WEIGHT = 0.15;
/** Bass on another chord tone (an inversion, G/B) still counts, a little less than the root. */
const BASS_INVERSION = 0.6;

const unit = (x: ArrayLike<number>) => {
  const n = Math.hypot(...Array.from(x)) || 1;
  return Array.from(x, (v) => v / n);
};

/** The chroma we match templates against: the mix, or mostly the side signal when stereo. */
function harmony(b: BeatFeatures): ArrayLike<number> {
  if (!b.side) return b.chroma;
  const [m, sd] = [unit(b.chroma), unit(b.side)];
  return m.map((v, i) => (1 - SIDE_MIX) * v + SIDE_MIX * sd[i]);
}

function beatScores(b: BeatFeatures): Float64Array {
  const out = scores(harmony(b));
  const bass = b.bass;
  if (bass) {
    const total = Array.from(bass).reduce((s, v) => s + v, 0);
    if (total > 0) {
      TEMPLATES.forEach((t, k) => {
        let share = 0;
        for (const pc of t.tones) share += bass[pc] * (pc === t.label.pc ? 1 : BASS_INVERSION);
        out[k] += (BASS_WEIGHT * share) / total;
      });
    }
  }
  return out;
}

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
  const chroma = beats.map(harmony);
  const novelty = chroma.map((c, i) => (i === 0 ? 0 : 1 - cosine(c, chroma[i - 1])));
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
 * Pitch classes at home in the key: natural minor plus the raised 7th (so E is at home in A minor),
 * or the major scale plus the relative minor's raised 7th (G# in C: E7 → Am is everywhere in pop,
 * and a minor song misread as its relative major keeps its E7 instead of turning it into Em7).
 */
function scaleOf(key: { pc: number; mode: 'major' | 'minor' }): Set<number> {
  const steps = key.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10, 11] : [0, 2, 4, 5, 7, 8, 9, 11];
  return new Set(steps.map((s) => (key.pc + s) % 12));
}

/**
 * Snap per-beat chroma to bars with a best path through the whole song
 * (Viterbi): each slot (a bar, or half a bar in 4/4) scores every chord,
 * changing chord costs something (more inside a bar than on a bar line),
 * and chords in the song's key get a small bonus. Passing melody notes are
 * outvoted by the beats around them. Consecutive equal chords merge; quiet
 * stretches become `null`. Beats before the first downbeat are dropped.
 */
export function toSegments(
  beats: readonly BeatFeatures[],
  beatsPerBar: number,
  firstDownbeat: number,
  key?: { pc: number; mode: 'major' | 'minor' },
): ChordSegment[] {
  const perBeat = beats.map(beatScores);
  const loud = Math.max(...beats.map((b) => b.energy), 0);
  const slotsPerBar = beatsPerBar === 4 ? 2 : 1;
  const slotLen = beatsPerBar / slotsPerBar;
  const scale = key ? scaleOf(key) : null;
  const inKey = TEMPLATES.map((t) => (scale && t.tones.every((pc) => scale.has(pc)) ? KEY_BONUS_PER_BEAT : 0));
  const N = TEMPLATES.length;
  const SILENT = N; // the extra state: no chord

  type Slot = { bar: number; beat: number; sums: Float64Array; beats: number; silent: boolean };
  const slots: Slot[] = [];
  for (let start = firstDownbeat, bar = 0; start < beats.length; start += beatsPerBar, bar++) {
    for (let slot = 0; slot < slotsPerBar; slot++) {
      const from = start + slot * slotLen;
      const to = Math.min(beats.length, from + slotLen);
      if (from >= to) break;
      const sums = new Float64Array(N);
      let energy = 0;
      for (let b = from; b < to; b++) {
        energy += beats[b].energy / (to - from);
        for (let k = 0; k < N; k++) sums[k] += perBeat[b][k];
      }
      slots.push({ bar, beat: slot * slotLen, sums, beats: to - from, silent: energy < loud * SILENCE_RATIO });
    }
  }
  if (!slots.length) return [];

  const emit = (s: Slot, k: number) => (k === SILENT ? (s.silent ? 0 : -Infinity) : s.silent ? -Infinity : s.sums[k] + inKey[k] * s.beats);
  let score = Array.from({ length: N + 1 }, (_, k) => emit(slots[0], k));
  const back: Int16Array[] = [];
  for (let i = 1; i < slots.length; i++) {
    const cost = slots[i].beat === 0 ? CHANGE_COST : CHANGE_COST * MID_BAR_CHANGE;
    let best = 0;
    for (let k = 1; k <= N; k++) if (score[k] > score[best]) best = k;
    const from = new Int16Array(N + 1);
    const next = new Array<number>(N + 1);
    for (let k = 0; k <= N; k++) {
      const change = score[best] - cost;
      from[k] = score[k] >= change ? k : best;
      next[k] = Math.max(score[k], change) + emit(slots[i], k);
    }
    back.push(from);
    score = next;
  }
  let state = 0;
  for (let k = 1; k <= N; k++) if (score[k] > score[state]) state = k;
  const path = new Array<number>(slots.length);
  for (let i = slots.length - 1; i >= 0; i--) {
    path[i] = state;
    if (i > 0) state = back[i - 1][state];
  }

  const out: ChordSegment[] = [];
  let open: Open | null = null;
  slots.forEach((s, i) => {
    const k = path[i] === SILENT ? null : TEMPLATES[path[i]].key;
    if (!open || k !== open.key) {
      if (open) out.push(close(open));
      open = { bar: s.bar, beat: s.beat, key: k, sums: new Float64Array(N), beats: 0 };
    }
    for (let j = 0; j < N; j++) open.sums[j] += s.sums[j];
    open.beats += s.beats;
  });
  if (open) out.push(close(open));
  return out;
}

/** Fill in beats the tracker missed before the music's first detected beat. */
export function extendBeats(times: readonly number[]): number[] {
  if (times.length < 2) return [...times];
  const intervals = times.slice(1, 9).map((t, i) => t - times[i]).sort((a, b) => a - b);
  const step = intervals[Math.floor(intervals.length / 2)];
  const before: number[] = [];
  // A beat a few ms before 0 is the clip starting on the beat: keep it, at 0.
  for (let t = times[0] - step; t >= -0.15 * step; t -= step) before.unshift(Math.max(0, t));
  return [...before, ...times];
}


/**
 * How evenly low-frequency onsets fall on alternate beats: min/max of the
 * mean bass energy just after even vs odd beats (1 = even, near 0 = strongly
 * alternating). Kick and bass on 1 and 3 alternate; a tracker counting the
 * picked eighth notes of a solo guitar does not.
 */
export function lowBandAlternation(samples: Float32Array, sampleRate: number, beats: readonly number[]): number {
  const a = Math.exp((-2 * Math.PI * 150) / sampleRate);
  const window = Math.floor(0.06 * sampleRate);
  const sums = [0, 0];
  const counts = [0, 0];
  let lp = 0;
  let next = 0;
  for (let i = 0, b = 0; i < samples.length && b < beats.length; i++) {
    lp = a * lp + (1 - a) * samples[i];
    const start = Math.floor(beats[b] * sampleRate);
    if (i >= start && i < start + window) {
      sums[b % 2] += lp * lp;
      next = start + window;
    }
    if (i >= next && i >= start + window) {
      counts[b % 2]++;
      b++;
    }
  }
  const even = sums[0] / Math.max(1, counts[0]);
  const odd = sums[1] / Math.max(1, counts[1]);
  const hi = Math.max(even, odd);
  return hi > 0 ? Math.sqrt(Math.min(even, odd) / hi) : 1;
}

const MAJOR_FAMILY = new Set(['maj', '7', 'maj7', '6', 'add9']);
const MINOR_FAMILY = new Set(['m', 'm7']);
/** The other reading must outweigh this one by this much before the mode flips. */
const MODE_FLIP_MARGIN = 1.2;
/** Songs start and end at home: the first and last chords count this much more. */
const ENDS_WEIGHT = 2;

/**
 * engine-spec §1 key mode: the key finder can't tell a key from its relative
 * (C major and A minor share every note), so let the chords say which one is
 * home. Each chord counts for its length in beats (the first and last twice);
 * if the relative's tonic chord clearly outweighs the key's own, the key moves
 * to the relative (same notes, other home).
 */
export function refineMode(
  key: { pc: number; mode: 'major' | 'minor' },
  chords: readonly ChordSegment[],
  beatsPerBar: number,
): { pc: number; mode: 'major' | 'minor' } {
  const majorPc = key.mode === 'major' ? key.pc : (key.pc + 3) % 12;
  const minorPc = (majorPc + 9) % 12;
  const at = (s: ChordSegment) => s.bar * beatsPerBar + s.beat;
  const voiced = chords.filter((c) => c.chord);
  let major = 0;
  let minor = 0;
  voiced.forEach((s, i) => {
    const next = voiced[i + 1];
    const beats = next ? Math.max(1, at(next) - at(s)) : beatsPerBar;
    const w = beats * (i === 0 || i === voiced.length - 1 ? ENDS_WEIGHT : 1);
    const c = s.chord as ChordLabel;
    if (c.pc === majorPc && MAJOR_FAMILY.has(c.quality)) major += w;
    if (c.pc === minorPc && MINOR_FAMILY.has(c.quality)) minor += w;
  });
  if (key.mode === 'major' && minor > major * MODE_FLIP_MARGIN) return { pc: minorPc, mode: 'minor' };
  if (key.mode === 'minor' && major > minor * MODE_FLIP_MARGIN) return { pc: majorPc, mode: 'major' };
  return key;
}
