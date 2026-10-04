import { serveAnalysis } from '@thumbline/audio-analysis/worker';

// Runs off the main thread; essentia's WASM loads here on first use.
serveAnalysis(self as unknown as Parameters<typeof serveAnalysis>[0]);
