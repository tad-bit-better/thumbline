import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useReducedMotion } from '../../motion';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant;
  /** `md` is 46px tall, `lg` 58px (hero actions). */
  size?: 'md' | 'lg';
  /** Decorative leading icon; the text is the label. */
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const reduced = useReducedMotion();
  return (
    <button
      type={type}
      className={[styles['button'], styles[variant], size === 'lg' && styles['lg'], className]
        .filter(Boolean)
        .join(' ')}
      data-variant={variant}
      data-reduced-motion={reduced ? '' : undefined}
      {...rest}
    >
      {icon && (
        <span className={styles['icon']} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
