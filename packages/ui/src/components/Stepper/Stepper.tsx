import { CheckGlyph } from '../glyphs';
import hidden from '../visually-hidden.module.css';
import styles from './Stepper.module.css';

export type StepperProps = {
  steps: readonly string[];
  /** 0-based index of the current step. */
  current: number;
  label?: string;
  className?: string;
};

/** Upload · Listen · Review · Play. Done steps are mint, the current one violet. */
export function Stepper({ steps, current, label = 'Progress', className }: StepperProps) {
  return (
    <nav aria-label={label} className={[styles['nav'], className].filter(Boolean).join(' ')}>
      <ol className={styles['list']}>
        {steps.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
          return (
            <li
              key={step}
              className={`${styles['step']} ${styles[state]}`}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className={styles['badge']} aria-hidden="true">
                {state === 'done' ? <CheckGlyph /> : i + 1}
              </span>
              <span className={styles['label']}>{step}</span>
              {state === 'done' && <span className={hidden['hidden']}>, done</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
