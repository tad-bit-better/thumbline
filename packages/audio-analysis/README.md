# @thumbline/audio-analysis

Uploaded clip → `AnalysisResult` (docs/engine-spec.md §1), entirely on the device. Decoding happens on the
main thread; analysis runs in a Web Worker with essentia.js (AGPL-3.0). Depends on nothing else in the repo.

```ts
// app: analysis.worker.ts
import { serveAnalysis } from '@thumbline/audio-analysis';
serveAnalysis(self);

// app: upload flow
const result = await analyzeFile(file, {
  createWorker: () => new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' }),
  onProgress: ({ step, fraction, detail }) => …,   // decode → beats → key → chords → done
  signal,                                          // cancel terminates the worker
});
```

Errors the UI should explain: `AnalysisError` with `code` `unsupported`, `too-long` (> 6 min), `too-short`, `silent`.

| File | What it does |
|---|---|
| `client.ts`, `decode.ts` | File checks, decode at 44.1 kHz, hand channels to the worker |
| `worker.ts` | Loads essentia once (single-file ES build, WASM inlined) and runs the pipeline |
| `pipeline.ts` | Tempo (Percival + Degara tracker, octave check), key, per-beat chroma of the mix, its bass band and the stereo side signal |
| `postprocess.ts` | Chord templates with overtones and a bass bonus, meter and downbeat, key-aware Viterbi over half bars, confidence, alternatives |

## Eval

```bash
pnpm nx run @thumbline/audio-analysis:eval
```

Generates synthetic songs (`tools/make-synthetic-fixtures.mjs`) and scores every clip in `fixtures/audio`
and `fixtures/synthetic`: tempo within ±3 BPM, meter, and chord accuracy (root, major/minor, exact),
sampled every 100 ms. Writes `test-output/eval.json`.
