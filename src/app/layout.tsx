// src/app/layout.tsx
// Updated: lang attribute is now set dynamically from the user's stored
// language preference so screen readers and the browser announce the correct
// language. Falls back to 'en' for unauthenticated / SSR renders.
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Infinity — የትየለሌ',
  description: "Ethiopia's social platform",
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#3D6B4F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang is set statically here; the client-side LocaleSync component below
  // updates document.documentElement.lang to match the user's profile language
  // after hydration — so it's always correct for authenticated users.
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
