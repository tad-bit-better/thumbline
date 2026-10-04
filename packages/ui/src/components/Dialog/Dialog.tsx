import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useReducedMotion } from '../../motion';
import { CloseGlyph } from '../glyphs';
import { IconButton } from '../IconButton/IconButton';
import styles from './Dialog.module.css';

export type DialogProps = {
  open: boolean;
  title: string;
  /** Called for the close button and Escape; the parent sets `open` to false. */
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Modal on the native <dialog>: focus trap, Escape and top layer come from the browser. */
export function Dialog({ open, title, onClose, children, actions, className }: DialogProps) {
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
      className={[styles['dialog'], className].filter(Boolean).join(' ')}
      data-reduced-motion={reduced ? '' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles['header']}>
        <h2 id={titleId} className={styles['title']}>
          {title}
        </h2>
        <IconButton label="Close" icon={<CloseGlyph />} variant="ghost" onClick={onClose} />
      </div>
      <div className={styles['body']}>{children}</div>
      {actions && <div className={styles['actions']}>{actions}</div>}
    </dialog>
  );
}
