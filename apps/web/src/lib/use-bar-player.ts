import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays one stretch of the original clip at a time (a bar on the sheet, from its chord picker).
 * The AudioContext is made on the first press, inside the click as browsers
 * require; the clip is decoded once, on the device. Pressing the playing bar
 * again stops it; leaving the page stops it and closes the context.
 */
export function useBarPlayer(file: Blob | null) {
  const [playing, setPlaying] = useState<number | null>(null);
  const playingRef = useRef<number | null>(null);
  const context = useRef<AudioContext | null>(null);
  const decoded = useRef<{ file: Blob; buffer: Promise<AudioBuffer> } | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  /** Bumped on every start and stop, so a slow decode can't start a bar that was stopped. */
  const run = useRef(0);

  const show = useCallback((id: number | null) => {
    playingRef.current = id;
    setPlaying(id);
  }, []);

  const stop = useCallback(() => {
    run.current++;
    const node = source.current;
    source.current = null;
    if (node) {
      node.onended = null;
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
      node.disconnect();
    }
    if (playingRef.current !== null) show(null);
  }, [show]);

  /** Start the stretch `id` (from `start` to `end` seconds), or stop it if it's the one playing. */
  const toggle = useCallback(
    async (id: number, start: number, end: number) => {
      const again = playingRef.current === id;
      stop();
      if (again || !file || end <= start) return;
      const mine = run.current;
      show(id);
      try {
        const ctx = (context.current ??= new AudioContext({ latencyHint: 'interactive' }));
        void ctx.resume();
        if (decoded.current?.file !== file) {
          decoded.current = { file, buffer: file.arrayBuffer().then((bytes) => ctx.decodeAudioData(bytes)) };
        }
        const buffer = await decoded.current.buffer;
        if (run.current !== mine) return;
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        node.onended = () => {
          if (run.current === mine) stop();
        };
        source.current = node;
        node.start(0, start, end - start);
      } catch {
        // The clip couldn't be decoded or played; drop the playing state quietly.
        decoded.current = null;
        if (run.current === mine) stop();
      }
    },
    [file, stop, show],
  );

  // A new clip: forget the old decode.
  useEffect(() => {
    stop();
    decoded.current = null;
  }, [file, stop]);

  // Leaving the page (or the tab being closed or hidden in the back-forward cache) stops the sound.
  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
      const ctx = context.current;
      context.current = null;
      decoded.current = null;
      void ctx?.close().catch(() => undefined);
    };
  }, [stop]);

  return { playing, toggle, stop };
}
