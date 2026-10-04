// Main-thread entry. The worker side is `@thumbline/audio-analysis/worker`.
export * from './types.js';
export * from './postprocess.js';
export * from './pipeline.js';
export * from './melody.js';
export * from './client.js';
export * from './decode.js';
export * from './messages.js';
export type { EssentiaLike, EssentiaVector } from './essentia.js';
