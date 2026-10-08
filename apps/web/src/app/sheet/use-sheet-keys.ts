import { useEffect, useRef } from 'react';

const isTyping = (el: Element | null) =>
  !!el &&
  (el.matches('input, textarea, select, [contenteditable="true"]') ||
    el.closest('dialog[open], [popover]') !== null);

export type SheetKeys = {
  /** Space (not on a button): play or pause. */
  togglePlay: () => void;
  /** L: loop on or off. */
  toggleLoop: () => void;
  /** 1, 2, 3: the level. */
  setLevel: (index: 0 | 1 | 2) => void;
  /** ← / →: a bar back or forward; absent when there's no sheet. */
  step?: (bars: -1 | 1) => void;
};

/** The Sheet's keyboard shortcuts (screens.md §4), off while typing or inside a dialog or popover. */
export function useSheetKeys(keys: SheetKeys) {
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = latest.current;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(document.activeElement)
      )
        return;
      const onButton = document.activeElement?.matches(
        'button, [role="radio"], input[type="radio"]',
      );
      if (e.key === ' ' && !onButton) {
        e.preventDefault();
        k.togglePlay();
      } else if (e.key === 'l' || e.key === 'L') k.toggleLoop();
      else if (e.key === '1' || e.key === '2' || e.key === '3')
        k.setLevel((Number(e.key) - 1) as 0 | 1 | 2);
      else if (
        (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
        k.step &&
        !document.activeElement?.matches('input[type="range"]')
      ) {
        // A bar back or forward, playing or paused (the slider handles its own arrows).
        e.preventDefault();
        k.step(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}
