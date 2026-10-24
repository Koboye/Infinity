import type { Metadata, Viewport } from 'next';
import './globals.css';
import './royal.css';
import './fullscreen.css';
import './kings3d.css';
import './v11.css';
import './v13.css';
import RegisterSW from '@/components/RegisterSW';
import '@fontsource/noto-sans-ethiopic/400.css';
import '@fontsource/noto-sans-ethiopic/600.css';
import '@fontsource/noto-sans-ethiopic/800.css';
import '@fontsource/noto-serif-ethiopic/600.css';
import '@fontsource/noto-serif-ethiopic/800.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/fraunces/900.css';

export const metadata: Metadata = {
  title: 'ገበጣ · ዳማ · ዱምና',
  description: 'Play ገበጣ (Gebeta), ዳማ (Dama) and ዱምና (Dumna) online with friends or against the computer.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'ገበጣ', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0E3B2C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-stone="gem" suppressHydrationWarning>
      <head>
      </head>
      <body>{children}<RegisterSW /></body>
    </html>
  );
}
