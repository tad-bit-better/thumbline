'use client';

import { ToastProvider } from '@thumbline/ui';
import { type ReactNode, useEffect } from 'react';
import { songStore } from '../lib/song-store';

/** Client-side app context: toasts, and the saved song restored from IndexedDB. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void songStore.getState().hydrate();
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
