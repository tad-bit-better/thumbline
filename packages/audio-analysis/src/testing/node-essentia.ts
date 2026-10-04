import { createRequire } from 'node:module';
import type { EssentiaLike } from '../essentia.js';

/** Essentia's UMD build for Node (tests and the eval script). */
export function loadEssentiaNode(): EssentiaLike {
  const require = createRequire(import.meta.url);
  const { EssentiaWASM, Essentia } = require('essentia.js') as {
    EssentiaWASM: unknown;
    Essentia: new (wasm: unknown) => EssentiaLike;
  };
  return new Essentia(EssentiaWASM);
}
