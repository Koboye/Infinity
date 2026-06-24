import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Dagu — Smart Social Video',
  description:
    'V5 of the Dagu social video experience: smart moderation, AI captions, semantic search, and a generation-ready architecture.',
  applicationName: 'Dagu',
  keywords: ['Dagu', 'social video', 'short video', 'creator', 'smart feed'],
  authors: [{ name: 'Dagu Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-bg-base text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
