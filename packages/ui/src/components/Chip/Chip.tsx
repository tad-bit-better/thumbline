import type { ReactNode } from 'react';
import { useReducedMotion } from '../../motion';
import styles from './Chip.module.css';

export type ChipTone = 'neutral' | 'violet' | 'orange' | 'mint' | 'rose';

export type ChipProps = {
  children: ReactNode;
  tone?: ChipTone;
  /** `mono` for data: BPM, file names, timings. */
  font?: 'sans' | 'mono';
  icon?: ReactNode;
  /** Makes the chip a toggle button. */
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Small pill label, or a toggle when given onClick. */
export function Chip({
  children,
  tone = 'neutral',
  font = 'sans',
  icon,
  onClick,
  selected,
  disabled,
  className,
}: ChipProps) {
  const reduced = useReducedMotion();
  const classes = [styles['chip'], styles[tone], font === 'mono' && styles['mono'], onClick && styles['button'], className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {icon && (
        <span className={styles['icon']} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </>
  );
  const data = { 'data-tone': tone, 'data-font': font, 'data-reduced-motion': reduced ? '' : undefined };
  if (!onClick) {
    return (
      <span className={classes} {...data}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      {...data}
    >
      {content}
    </button>
  );
}
