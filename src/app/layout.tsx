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
import './majestic.css';
import './ludo.css';
import './spin2.css';
import './v32.css';
import './v36.css';
import './v36-rails.css';
import './v39.css';
import './v40.css';
import './v41.css';
import './v42.css';
import './v43.css';
import './v44.css';
import './v45.css';
import './v46.css';
import './v47.css';
import './v48.css';
import './v49.css';
import './v50.css';
import './v51.css';
import './v52.css';
import './v53.css';
import './ads.css';
import './earn.css';
import './brand.css';
import './v73.css';
import './v74.css';
import './v78.css';
import './v79.css';
import './v80.css';
import './v84.css';
import './v92.css';
import './v95.css';
import './v96.css';
import './v97.css';
import './release.css';
import './tg.css';
import './wa.css';
import './afro.css';
import './fit.css';
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
  title: { default: 'Afro Zone', template: '%s · Afro Zone' },
  description: 'Afro Zone: play ገበጣ (Gebeta), ዳማ (Dama), Ludo, Dominoes, Bingo and Hill Climb online with friends or offline against the computer.',
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://infinity.vercel.app'),
  openGraph: { title: 'Afro Zone', siteName: 'Afro Zone', description: 'Gebeta, Dama, Ludo, Dominoes and Bingo — play online or offline.', images: ['/og-image.png'], type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Afro Zone', images: ['/og-image.png'] },
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'Afro Zone', statusBarStyle: 'black-translucent' },
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
          {'v' + (process.env.NEXT_PUBLIC_APP_VERSION || '') + '  ' + (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)}
        </div>
      </body>
    </html>
  );
}
