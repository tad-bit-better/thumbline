// `@thumbline/audio-analysis/worker`: the Web Worker side (essentia). Kept out of
// the main entry so pages never pull essentia's 2.5 MB WASM build into their bundle.
export * from './essentia.js';
export * from './worker.js';
