import { ANALYSIS_SAMPLE_RATE } from './pipeline.js';

/** Decoded audio at 44.1 kHz, one array per channel (mixed to mono in the worker). */
export type Decoded = { channels: Float32Array[]; sampleRate: number };

/**
 * Browser main thread: decode a file at 44.1 kHz (decodeAudioData resamples
 * to the context's rate). Workers have no AudioContext, so decoding happens
 * here; channels are copied out (a fast memcpy) and mixed in the worker.
 */
export async function decodeToMono(file: Blob): Promise<Decoded> {
  const ctx = new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE);
  const audio = await ctx.decodeAudioData(await file.arrayBuffer());
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => {
    const data = new Float32Array(audio.length);
    audio.copyFromChannel(data, c);
    return data;
  });
  return { channels, sampleRate: audio.sampleRate };
}
