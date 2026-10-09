import { useCallback, useEffect, useRef, useState } from 'react';
import { audioContext, decodeOriginal, wake } from './original-audio';

/**
 * Plays one stretch of the original clip at a time (a bar on the sheet, from its chord picker).
 * It shares the sheet player's AudioContext and decode of the clip
 * (original-audio.ts), woken inside the click as browsers require. Pressing
 * the playing bar again stops it; leaving the page stops it.
 */
export function useBarPlayer(file: Blob | null) {
  const [playing, setPlaying] = useState<number | null>(null);
  const playingRef = useRef<number | null>(null);
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
        wake();
        const ctx = audioContext();
        const buffer = await decodeOriginal(file);
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
        if (run.current === mine) stop();
      }
    },
    [file, stop, show],
  );

  // A new clip: stop the old one.
  useEffect(() => {
    stop();
  }, [file, stop]);

  // Leaving the page (or the tab being closed or hidden in the back-forward cache) stops the sound.
  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  return { playing, toggle, stop };
}
