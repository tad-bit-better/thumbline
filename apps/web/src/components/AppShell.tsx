import { Logo } from '@thumbline/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

/** Page frame: logo on the left, contextual actions or the stepper on the right. */
export function AppShell({ actions, children, wide = false }: { actions?: ReactNode; children: ReactNode; /** Up to 1440px instead of 1200px (the Sheet's three columns). */ wide?: boolean }) {
  return (
    <div className={[styles.page, wide && styles.wide].filter(Boolean).join(' ')}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.brand}>
          <Logo size={40} />
        </Link>
        {actions && <div className={styles.actions}>{actions}</div>}
      </nav>
      {children}
    </div>
  );
}

export const STEPS = ['Upload', 'Listen', 'Review', 'Play'] as const;
