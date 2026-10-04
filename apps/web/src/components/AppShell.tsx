import { Pick } from '@thumbline/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

/** Page frame: logo on the left, contextual actions or the stepper on the right. */
export function AppShell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.brand}>
          <Pick size={40} />
          <span className={styles.wordmark}>Thumbline</span>
        </Link>
        {actions && <div className={styles.actions}>{actions}</div>}
      </nav>
      {children}
    </div>
  );
}

export const STEPS = ['Upload', 'Listen', 'Review', 'Play'] as const;
