import type { Metadata, Viewport } from 'next';
import './globals.css';
import './royal.css';
import './fullscreen.css';
import './kings3d.css';
import './v11.css';
import './v13.css';
import './polish.css';
import './smart.css';
import './kick.css';
import './celebrate.css';
import './final.css';
import './world.css';
import './tuz.css';
import './spin2.css';
import './v32.css';
import './v36.css';
import './v36-rails.css';
import RegisterSW from '@/components/RegisterSW';
import ViewportFit from '@/components/ViewportFit';
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
  title: 'ገበጣ · ዳማ',
  description: 'Play ገበጣ (Gebeta), ዳማ (Dama) online with friends or against the computer.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'ገበጣ', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: "#072A1F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-stone="gem" suppressHydrationWarning>
      <head>
      </head>
      <body>
        {children}
        <RegisterSW />
        <ViewportFit />
        {/* tiny build label: shows which version of the app is really running on a phone */}
        <div aria-hidden="true" style={{ position: 'fixed', right: 6, bottom: 2, fontSize: 9, opacity: 0.35, pointerEvents: 'none', zIndex: 1, color: '#fff' }}>
          {'v36  ' + (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)}
        </div>
      </body>
    </html>
  );
}
