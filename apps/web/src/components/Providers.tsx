'use client';

import { ToastProvider, setLottieWasmUrl } from '@thumbline/ui';
import { type ReactNode, useEffect } from 'react';
import { LOTTIE } from '../lib/lottie';
import { songStore } from '../lib/song-store';

// Before any moment plays: the renderer comes from us, not a CDN.
setLottieWasmUrl(LOTTIE.wasm);

/** Client-side app context: toasts, and the saved song restored from IndexedDB. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void songStore.getState().hydrate();
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
