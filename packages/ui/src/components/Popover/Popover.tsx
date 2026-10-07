import {
  type ReactNode,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from '../../motion';
import styles from './Popover.module.css';

export type PopoverTriggerProps = {
  ref: RefCallback<HTMLElement>;
  onClick: () => void;
  onPointerDown: () => void;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': 'dialog';
};

export type PopoverProps = {
  /** Accessible name of the panel. */
  label: string;
  /** Render the trigger and spread these props onto it. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

const GAP = 8;
const EDGE = 8;
const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

function place(panel: HTMLElement, trigger: HTMLElement) {
  const t = trigger.getBoundingClientRect();
  panel.style.maxHeight = '';
  const { width, height } = panel.getBoundingClientRect();
  const left = Math.min(Math.max(t.left + t.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE);
  // Below if it fits, otherwise whichever side has more room (and scroll inside).
  const spaceBelow = window.innerHeight - t.bottom - GAP - EDGE;
  const spaceAbove = t.top - GAP - EDGE;
  const below = height <= spaceBelow || spaceBelow >= spaceAbove;
  const room = below ? spaceBelow : spaceAbove;
  const shown = Math.min(height, room);
  if (height > room) panel.style.maxHeight = `${room}px`;
  panel.style.left = `${left}px`;
  panel.style.top = `${below ? t.bottom + GAP : t.top - GAP - shown}px`;
  panel.style.transformOrigin = `${t.left + t.width / 2 - left}px ${below ? 'top' : 'bottom'}`;
}

/** Light-dismiss panel anchored to a trigger (chord alternatives). Pops from 92% scale. */
export function Popover({ label, trigger, children, onOpenChange, className }: PopoverProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const pressedWhileOpen = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const reposition = () => triggerRef.current && place(panel, triggerRef.current);
    const onToggle = (e: Event) => {
      const isOpen = (e as Event & { newState?: string }).newState === 'open';
      openRef.current = isOpen;
      setOpen(isOpen);
      onOpenChangeRef.current?.(isOpen);
      if (isOpen) {
        reposition();
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        const first = panel.querySelector<HTMLElement>(FOCUSABLE);
        // Content rendered only while open (onOpenChange) arrives a frame later.
        if (first) first.focus();
        else requestAnimationFrame(() => panel.querySelector<HTMLElement>(FOCUSABLE)?.focus());
      } else {
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
        const active = document.activeElement;
        if (!active || active === document.body || panel.contains(active)) triggerRef.current?.focus();
      }
    };
    panel.addEventListener('toggle', onToggle);
    return () => {
      panel.removeEventListener('toggle', onToggle);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, []);

  const close = useCallback(() => {
    if (openRef.current) panelRef.current?.hidePopover();
  }, []);

  const triggerProps: PopoverTriggerProps = {
    ref: (el) => {
      triggerRef.current = el;
    },
    // Light dismiss closes the popover on pointerdown, before the trigger's click.
    onPointerDown: () => {
      pressedWhileOpen.current = openRef.current;
    },
    onClick: () => {
      const wasOpen = pressedWhileOpen.current ?? openRef.current;
      pressedWhileOpen.current = null;
      if (wasOpen) close();
      else panelRef.current?.showPopover();
    },
    'aria-expanded': open,
    'aria-controls': id,
    'aria-haspopup': 'dialog',
  };

  return (
    <>
      {trigger(triggerProps)}
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={[styles['panel'], className].filter(Boolean).join(' ')}
        data-reduced-motion={reduced ? '' : undefined}
      >
        {typeof children === 'function' ? children({ close }) : children}
      </div>
    </>
  );
}
