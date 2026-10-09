/**
 * The Sheet's sound, shared by the sheet player and "Hear this bar": one
 * AudioContext for the visit (the synth's notes are kept per context, so a
 * new arrangement reuses them) and one decode of the original per clip
 * (a 4-minute song is about 85 MB decoded; decoding it twice cost the memory twice).
 */
let shared: AudioContext | null = null;
const decodes = new WeakMap<Blob, Promise<AudioBuffer>>();

/**
 * The context, made on first use. Made before any click it starts suspended:
 * call `wake()` inside the click, before any await, as browsers require.
 */
export function audioContext(): AudioContext {
  return (shared ??= new AudioContext({ latencyHint: 'interactive' }));
}

/** Let the context play: call it synchronously inside the click that starts sound. */
export function wake(): void {
  void audioContext()
    .resume()
    .catch(() => undefined);
}

/** Leaving the Sheet: the context stops drawing power until it's needed again. */
export function rest(): void {
  void shared?.suspend().catch(() => undefined);
}

/** The clip decoded on this device, once per clip; a failed decode can be tried again. */
export function decodeOriginal(file: Blob): Promise<AudioBuffer> {
  let p = decodes.get(file);
  if (!p) {
    p = file.arrayBuffer().then((bytes) => audioContext().decodeAudioData(bytes));
    p.catch(() => decodes.delete(file));
    decodes.set(file, p);
  }
  return p;
}

/** Decode the clip while the page is idle, so Play doesn't wait for it. Returns a cancel. */
export function decodeWhenIdle(file: Blob): () => void {
  const start = () => void decodeOriginal(file).catch(() => undefined);
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(start, IDLE_TIMEOUT_MS);
  return () => clearTimeout(id);
}

/** At the latest this long after the sheet opens (a debounce, not an animation). */
const IDLE_TIMEOUT_MS = 2000;
