/** Test audio: sustained chords plus a click on every beat. */
const PC: Record<string, number> = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const SHAPE: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10] };

export function chordClip(chart: string[], { bpm = 100, beatsPerBar = 4, sampleRate = 44100, leadIn = 0 } = {}) {
  const beat = 60 / bpm;
  const bars = chart.length;
  const seconds = leadIn + bars * beatsPerBar * beat + 0.5;
  const x = new Float32Array(Math.floor(seconds * sampleRate));
  chart.forEach((name, bar) => {
    const m = /^([A-G][b#]?)(.*)$/.exec(name) as RegExpExecArray;
    const root = PC[m[1]];
    const freqs = SHAPE[m[2]].map((iv) => 130.81 * 2 ** (((root + iv) % 12) / 12));
    freqs.push(65.41 * 2 ** (root / 12));
    const from = Math.floor((leadIn + bar * beatsPerBar * beat) * sampleRate);
    const to = Math.floor((leadIn + (bar + 1) * beatsPerBar * beat) * sampleRate);
    for (let i = from; i < to && i < x.length; i++) {
      const t = i / sampleRate;
      let v = 0;
      for (const f of freqs) v += Math.sin(2 * Math.PI * f * t) * 0.1;
      x[i] += v;
    }
  });
  for (let b = 0; b * beat + leadIn < seconds - 0.5; b++) {
    const at = Math.floor((leadIn + b * beat) * sampleRate);
    const accent = b % beatsPerBar === 0 ? 0.9 : 0.5;
    for (let i = 0; i < 2000 && at + i < x.length; i++) x[at + i] += Math.sin(i * 0.31) * Math.exp(-i / 220) * accent;
  }
  return x;
}
