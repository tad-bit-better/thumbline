import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** A step of the app, holding only the visitor's own song: nothing for search engines. */
export const metadata: Metadata = {
  title: 'Your sheet',
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
