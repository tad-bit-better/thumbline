import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useReducedMotion } from '../../motion';
import { CloseGlyph } from '../glyphs';
import { IconButton } from '../IconButton/IconButton';
import styles from './Drawer.module.css';

export type DrawerProps = {
  open: boolean;
  title: string;
  /** Called for the close button, Escape and a click on the backdrop; the parent sets `open` to false. */
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * A panel that slides in from the right (a bottom sheet on narrow screens), over a light
 * backdrop so the page stays visible behind it. Built on the native <dialog> like Dialog:
 * focus trap, Escape and top layer come from the browser.
 */
export function Drawer({ open, title, onClose, children, className }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reduced = useReducedMotion();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const isOpen = dialog.hasAttribute('open');
    if (open && !isOpen) dialog.showModal();
    if (!open && isOpen) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={[styles['drawer'], className].filter(Boolean).join(' ')}
      data-reduced-motion={reduced ? '' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself (the panel's content is inside it).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles['panel']}>
        <div className={styles['header']}>
          <h2 id={titleId} className={styles['title']}>
            {title}
          </h2>
          <IconButton label="Close" icon={<CloseGlyph />} variant="ghost" onClick={onClose} />
        </div>
        <div className={styles['body']}>{children}</div>
      </div>
    </dialog>
  );
}
