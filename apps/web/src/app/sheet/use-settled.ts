import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a slider rests before the sheet re-arranges (a debounce, not an animation). */
export const SETTLE_MS = 300;

/**
 * A value a slider drags: shown at once (`shown`), committed once the hand
 * rests (`commit`, after SETTLE_MS). `cancel` drops a pending commit.
 */
export function useSettled<T>(value: T, commit: (next: T) => void) {
  const [draft, setDraft] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => clearTimeout(timer.current), []);
  const nudge = useCallback((next: T) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      commitRef.current(next);
      setDraft(null);
    }, SETTLE_MS);
  }, []);
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    setDraft(null);
  }, []);
  return { shown: draft ?? value, nudge, cancel };
}
