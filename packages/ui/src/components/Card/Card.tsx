import type { HTMLAttributes, ReactNode } from 'react';
import { useReducedMotion } from '../../motion';
import styles from './Card.module.css';

export type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
  padding?: 'sm' | 'md' | 'lg';
  /** Lift and tilt on hover; children with `data-tilt` (icons) tilt further. */
  interactive?: boolean;
};

/** White surface with the soft violet card shadow. */
export function Card({
  children,
  as: Tag = 'div',
  padding = 'md',
  interactive = false,
  className,
  ...rest
}: CardProps) {
  const reduced = useReducedMotion();
  return (
    <Tag
      className={[styles['card'], styles[padding], interactive && styles['interactive'], className]
        .filter(Boolean)
        .join(' ')}
      data-padding={padding}
      data-interactive={interactive ? '' : undefined}
      data-reduced-motion={reduced ? '' : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
