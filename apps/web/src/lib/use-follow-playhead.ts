import type { PlayheadView } from '@thumbline/tab-renderer';
import { useCallback, useEffect, useRef, useState } from 'react';

/** After the reader stops scrolling with the playing row on screen, following resumes after this long. */
export const SETTLE_MS = 1200;
/** Keys that scroll the page, when the focus isn't in a control (Space plays and pauses on the Sheet). */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);
const isControl = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName) || t.getAttribute('role') === 'slider');

export type FollowPlayhead = {
  /** The sheet scrolls itself to the playing row. */
  following: boolean;
  /** Where the playing row is: drives the pill's arrow. */
  where: PlayheadView;
  /** Pass to TabSheet: bumps when the reader asks to go back. */
  jumpKey: number;
  onPlayheadView: (where: PlayheadView) => void;
  /** "Back to the playhead": follow again and bring the row into view. */
  back: () => void;
  /** A seek or play: follow again (the sheet scrolls on the next row change). */
  resume: () => void;
};

/**
 * PLAN M10 follow rule: follow the playhead until the reader scrolls (wheel,
 * touch, scroll keys, the scrollbar); then stop, and come back when they ask
 * (the pill or F), seek, or rest with the playing row on screen. Never on a
 * timer alone, so reading the style cards isn't interrupted.
 */
export function useFollowPlayhead(): FollowPlayhead {
  const [following, setFollowing] = useState(true);
  const [where, setWhere] = useState<PlayheadView>('visible');
  const [jumpKey, setJumpKey] = useState(0);
  const lastScroll = useRef(0);
  const whereRef = useRef<PlayheadView>('visible');
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const back = useCallback(() => {
    setFollowing(true);
    setJumpKey((k) => k + 1);
  }, []);
  const resume = useCallback(() => setFollowing(true), []);

  // Resting with the playing row on screen means the reader is with it again.
  const checkSettled = useCallback(() => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (whereRef.current === 'visible' && performance.now() - lastScroll.current >= SETTLE_MS - 50) setFollowing(true);
    }, SETTLE_MS);
  }, []);

  const onPlayheadView = useCallback(
    (w: PlayheadView) => {
      whereRef.current = w;
      setWhere(w);
      if (w === 'visible') checkSettled();
    },
    [checkSettled],
  );

  useEffect(() => {
    const scrolled = () => {
      lastScroll.current = performance.now();
      setFollowing(false);
      checkSettled();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isControl(e.target)) return;
      if (e.key === 'f' || e.key === 'F') back();
      else if (SCROLL_KEYS.has(e.key)) scrolled();
    };
    // The scrollbar: a press on the page's own edge, not on content.
    const onPointer = (e: PointerEvent) => {
      if (e.target === document.documentElement) scrolled();
    };
    window.addEventListener('wheel', scrolled, { passive: true });
    window.addEventListener('touchmove', scrolled, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('wheel', scrolled);
      window.removeEventListener('touchmove', scrolled);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      clearTimeout(settle.current);
    };
  }, [back, checkSettled]);

  return { following, where, jumpKey, onPlayheadView, back, resume };
}
