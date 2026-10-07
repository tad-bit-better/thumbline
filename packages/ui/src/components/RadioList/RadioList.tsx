import { useId } from 'react';
import styles from './RadioList.module.css';

export type RadioListOption<T extends string> = { value: T; label: string; hint?: string };

export type RadioListProps<T extends string> = {
  /** Accessible name of the group (shown by the caller). */
  label: string;
  options: ReadonlyArray<RadioListOption<T>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

/** A vertical list of choices, one line each with an optional hint (native radios, so keys work). */
export function RadioList<T extends string>({ label, options, value, onChange, disabled, className }: RadioListProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={[styles['list'], className].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <label key={o.value} className={styles['option']} data-checked={o.value === value ? '' : undefined}>
          <input
            type="radio"
            className={styles['input']}
            name={name}
            value={o.value}
            checked={o.value === value}
            disabled={disabled}
            onChange={() => onChange(o.value)}
          />
          <span className={styles['text']}>
            <b>{o.label}</b>
            {o.hint && <span className={styles['hint']}>{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
