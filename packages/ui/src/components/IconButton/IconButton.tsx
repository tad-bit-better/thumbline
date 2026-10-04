import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useReducedMotion } from '../../motion';
import buttonStyles from '../Button/Button.module.css';
import type { ButtonVariant } from '../Button/Button';
import styles from './IconButton.module.css';

export type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'> & {
  /** Accessible name; required because the button has no visible text. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  /** Set for toggles (loop on/off); leave undefined for plain actions. */
  pressed?: boolean;
};

/** A 44px round icon-only button. */
export function IconButton({
  label,
  icon,
  variant = 'secondary',
  pressed,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const reduced = useReducedMotion();
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={[buttonStyles['button'], buttonStyles[variant], styles['iconButton'], className]
        .filter(Boolean)
        .join(' ')}
      data-variant={variant}
      data-reduced-motion={reduced ? '' : undefined}
      {...rest}
    >
      <span className={styles['glyph']} aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
