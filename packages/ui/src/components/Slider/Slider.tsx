import { useId } from 'react';
import styles from './Slider.module.css';

export type SliderProps = {
  /** Visible label above the track. */
  label: string;
  /** 0..1 */
  value: number;
  onChange: (value: number) => void;
  /** Words under each end of the track, e.g. "Calm" and "Driving". */
  minLabel: string;
  maxLabel: string;
  /** What a screen reader says for a value, e.g. "40%, calm". Defaults to a percentage. */
  valueText?: (value: number) => string;
  /** Step, 0..1 (default 0.05). */
  step?: number;
  disabled?: boolean;
  className?: string;
};

/** A labelled 0–1 slider with words at both ends (a native range input, so keys and touch work). */
export function Slider({ label, value, onChange, minLabel, maxLabel, valueText, step = 0.05, disabled, className }: SliderProps) {
  const id = useId();
  const ends = `${id}-ends`;
  return (
    <div className={[styles['field'], className].filter(Boolean).join(' ')} data-disabled={disabled ? '' : undefined}>
      <label htmlFor={id} className={styles['label']}>
        {label}
      </label>
      <input
        id={id}
        className={styles['input']}
        type="range"
        min={0}
        max={1}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={ends}
        aria-valuetext={valueText ? valueText(value) : `${Math.round(value * 100)}%`}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <div id={ends} className={styles['ends']}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
