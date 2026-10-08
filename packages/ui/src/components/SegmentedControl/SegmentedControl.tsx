import * as m from 'motion/react-m';
import { useId } from 'react';
import { SPRING_BOUNCE, useReducedMotion } from '../../motion';
import styles from './SegmentedControl.module.css';

export type SegmentOption<V extends string> = { value: V; label: string; disabled?: boolean };

export type SegmentedControlProps<V extends string> = {
  /** Accessible name of the group, e.g. "Level". */
  label: string;
  options: ReadonlyArray<SegmentOption<V>>;
  value: V;
  onChange: (value: V) => void;
  /** `primary`: violet pill with a 3D edge. `secondary`: white pill. */
  tone?: 'primary' | 'secondary';
  /** Stretch segments to fill the width. */
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Radio group with a pill that slides to the selected option (moment #6). */
export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
  tone = 'primary',
  fullWidth = false,
  disabled = false,
  className,
}: SegmentedControlProps<V>) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={[styles['track'], styles[tone], fullWidth && styles['full'], className].filter(Boolean).join(' ')}
      data-reduced-motion={reduced ? '' : undefined}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const off = disabled || option.disabled === true;
        return (
          <label
            key={option.value}
            className={[styles['segment'], selected && styles['selected'], off && styles['disabled']]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="radio"
              className={styles['input']}
              name={id}
              value={option.value}
              checked={selected}
              disabled={off}
              onChange={() => onChange(option.value)}
            />
            {selected &&
              (reduced ? (
                <span className={styles['pill']} data-pill="" />
              ) : (
                <m.span layoutId={`${id}-pill`} className={styles['pill']} data-pill="" transition={SPRING_BOUNCE} />
              ))}
            <span className={styles['text']}>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
