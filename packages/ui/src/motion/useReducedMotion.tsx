import { MotionConfig } from 'motion/react';
import { type ReactNode, createContext, useContext, useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** `undefined` = follow the system setting. */
const ReducedMotionContext = createContext<boolean | undefined>(undefined);

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/**
 * True when motion should be reduced: the system setting, unless a
 * `ReducedMotionProvider` above forces it either way.
 */
export function useReducedMotion(): boolean {
  const forced = useContext(ReducedMotionContext);
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return forced ?? system;
}

/** Force reduced motion on or off for a subtree (Storybook, tests, user setting). */
export function ReducedMotionProvider({
  reduced,
  children,
}: {
  reduced?: boolean;
  children: ReactNode;
}) {
  const mode = reduced === undefined ? 'user' : reduced ? 'always' : 'never';
  return (
    <ReducedMotionContext.Provider value={reduced}>
      <MotionConfig reducedMotion={mode}>{children}</MotionConfig>
    </ReducedMotionContext.Provider>
  );
}
