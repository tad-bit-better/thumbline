import { useCallback, useRef, useState } from 'react';

/**
 * Width of an element, tracked with ResizeObserver (fallback where it's missing). A callback
 * ref, so it starts observing whenever the element appears, not only on the first render.
 */
export function useWidth<T extends HTMLElement>(fallback = 960) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.current.observe(el);
  }, []);
  return [ref, width] as const;
}
