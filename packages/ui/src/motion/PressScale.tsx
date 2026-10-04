import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { SPRING_SNAP } from './springs';
import { useReducedMotion } from './useReducedMotion';

const PRESSED_SCALE = 0.96;

/** Shrinks slightly while pressed (snap spring). For non-button tappables like cards. */
export function PressScale({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} data-reduced-motion="">
        {children}
      </div>
    );
  }
  return (
    <motion.div className={className} whileTap={{ scale: PRESSED_SCALE }} transition={SPRING_SNAP}>
      {children}
    </motion.div>
  );
}
