import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { TOAST_MS, useReducedMotion } from '../../motion';
import { CloseGlyph } from '../glyphs';
import { IconButton } from '../IconButton/IconButton';
import styles from './Toast.module.css';

export { TOAST_MS };

export type ToastTone = 'neutral' | 'success' | 'warning';
export type ToastOptions = { message: string; tone?: ToastTone };
type ToastItem = Required<ToastOptions> & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/** Show a short status message: `const toast = useToast(); toast({ message })`. */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside a ToastProvider');
  return show;
}

/** Owns the live region (rendered up front so screen readers catch new messages). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const reduced = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ message, tone = 'neutral' }: ToastOptions) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className={styles['region']} data-reduced-motion={reduced ? '' : undefined}>
        {items.map((t) => (
          <div key={t.id} className={`${styles['toast']} ${styles[t.tone]}`}>
            <span className={styles['dot']} aria-hidden="true" />
            <span className={styles['message']}>{t.message}</span>
            <IconButton
              label="Dismiss"
              icon={<CloseGlyph />}
              variant="ghost"
              className={styles['dismiss']}
              onClick={() => dismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
