import { Children, type CSSProperties, type ReactNode } from 'react';
import styles from './Reveal.module.css';
import { useReducedMotion } from './useReducedMotion';

/** Beyond this many items the rest pop in together (docs/design/motion.md). */
export const REVEAL_MAX_STAGGERED = 60;

export type RevealProps = {
  children: ReactNode;
  /** Change it to replay the reveal, e.g. on a style or level switch. */
  revealKey?: string | number;
  /** `g` inside SVG (tab notes), `span` inline, `div` otherwise. */
  as?: 'div' | 'span' | 'g';
  className?: string;
};

/** Staggered pop-in: each child scales 0 → 1.25 → 1, left to right. */
export function Reveal({ children, revealKey = 0, as = 'div', className }: RevealProps) {
  const reduced = useReducedMotion();
  const Container = as;
  if (reduced) return <Container className={className}>{children}</Container>;

  const Item = as;
  const itemClass = as === 'span' ? `${styles['item']} ${styles['inline']}` : styles['item'];
  return (
    <Container className={className}>
      {Children.toArray(children).map((child, i) => (
        <Item
          key={`${revealKey}:${i}`}
          data-reveal-item=""
          className={itemClass}
          style={{ '--reveal-index': String(Math.min(i, REVEAL_MAX_STAGGERED)) } as CSSProperties}
        >
          {child}
        </Item>
      ))}
    </Container>
  );
}
