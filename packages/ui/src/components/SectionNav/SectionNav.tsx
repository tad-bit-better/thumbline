import styles from './SectionNav.module.css';

export type SectionNavItem = { id: string; title: string; detail?: string };

export type SectionNavProps = {
  /** Accessible name of the navigation, e.g. "Sections". */
  label: string;
  items: readonly SectionNavItem[];
  /** The current item (the one playing), shown highlighted. */
  current?: string;
  onSelect: (id: string) => void;
  /** `list`: stacked rows with a detail line (a side column). `chips`: a scrolling row of pills (narrow screens). */
  variant?: 'list' | 'chips';
  className?: string;
};

/** Jump between parts of a page: a list of buttons with the current one marked. */
export function SectionNav({ label, items, current, onSelect, variant = 'list', className }: SectionNavProps) {
  return (
    <nav aria-label={label} className={[styles['nav'], styles[variant], className].filter(Boolean).join(' ')}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles['item']}
              aria-current={item.id === current ? 'true' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <span className={styles['title']}>{item.title}</span>
              {item.detail && <span className={styles['detail']}>{item.detail}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
