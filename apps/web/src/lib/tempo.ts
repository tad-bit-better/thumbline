import type { AnalysisResult } from '@thumbline/engine';

export type TempoScale = 0.5 | 1 | 2;

/**
 * The song counted at half or double the tempo we heard, for when the beat
 * finder locked onto twice (or half) the song's pulse (Pehla Nasha: 76 bpm
 * read as 152). Halving keeps every other beat from bar 0's downbeat; doubling
 * puts a beat midway between each two (and half a beat after the last). Chords,
 * key changes and loudness move with their beats; the tune is in seconds and
 * stays put.
 */
// MUSIC-REVIEW: halving keeps bar 0's downbeat, so a song whose real bar starts halfway through
// the counted pair of bars comes out half a bar late; the reader can still move chords by ear.
export function scaleTempo(a: AnalysisResult, scale: TempoScale): AnalysisResult {
  if (scale === 1) return a;
  const bpb = a.meter.beatsPerBar;
  const atBeat = (bar: number, beat: number) => bar * bpb + beat;
  const fromBeat = (n: number) => ({ bar: Math.floor(n / bpb), beat: n % bpb });
  if (scale === 0.5) {
    const phase = a.barStartBeat % 2;
    const kept = a.beatTimesSec.flatMap((t, i) => (i % 2 === phase ? [i] : []));
    return {
      ...a,
      bpm: Math.round((a.bpm / 2) * 10) / 10,
      beatTimesSec: kept.map((i) => a.beatTimesSec[i]),
      barStartBeat: Math.floor(a.barStartBeat / 2),
      chords: a.chords.map((c) => ({ ...c, ...fromBeat(Math.floor(atBeat(c.bar, c.beat) / 2)) })),
      ...(a.keys ? { keys: a.keys.map((k) => ({ ...k, bar: Math.floor(k.bar / 2) })) } : {}),
      ...(a.beatEnergy ? { beatEnergy: kept.map((i) => ((a.beatEnergy as number[])[i] + ((a.beatEnergy as number[])[i + 1] ?? (a.beatEnergy as number[])[i])) / 2) } : {}),
    };
  }
  const t = a.beatTimesSec;
  const last = t.length > 1 ? t[t.length - 1] - t[t.length - 2] : 60 / a.bpm;
  return {
    ...a,
    bpm: Math.round(a.bpm * 2 * 10) / 10,
    beatTimesSec: t.flatMap((x, i) => [x, x + ((t[i + 1] ?? x + last) - x) / 2]),
    barStartBeat: a.barStartBeat * 2,
    chords: a.chords.map((c) => ({ ...c, ...fromBeat(atBeat(c.bar, c.beat) * 2) })),
    ...(a.keys ? { keys: a.keys.map((k) => ({ ...k, bar: k.bar * 2 })) } : {}),
    ...(a.beatEnergy ? { beatEnergy: a.beatEnergy.flatMap((e) => [e, e]) } : {}),
  };
}
