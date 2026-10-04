import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import '@thumbline/ui/tokens.css';
import './global.css';

// Self-hosted at build time by next/font: no runtime requests to Google.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Thumbline',
  description:
    'Upload a song clip and get a right-hand guitar part to play along with.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
