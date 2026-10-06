import { type ReactNode, useId } from 'react';
import styles from './Checkbox.module.css';

export type CheckboxProps = {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/** A native checkbox with its label: a 44px target, the brand's violet tick, the browser's own keyboard and focus. */
export function Checkbox({ label, checked, onChange, disabled = false, className }: CheckboxProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={[styles['row'], disabled && styles['disabled'], className].filter(Boolean).join(' ')}>
      <input id={id} type="checkbox" className={styles['box']} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
