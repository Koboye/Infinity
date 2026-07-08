import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Infinity',
  description: 'Infinity App',
  manifest: '/manifest.json',
  icons: {
    icon: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    apple: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
  },
};

// `width: device-width, initialScale: 1` was missing entirely, which meant mobile
// browsers fell back to a virtual desktop-width viewport (~980px) and scaled the whole
// page down to fit the screen — the actual cause of text looking a different, often
// tiny/inconsistent size from one phone to the next, not any single font-size value in
// the app. `maximumScale` is left generous (not locked to 1) so people who need to pinch
// -zoom for accessibility still can, matching Telegram/Facebook's own mobile web behavior.
// `themeColor` also updated from the old purple (#8B5CF6, leftover from an earlier
// design direction) to the app's real brand blue — this is what colors the OS/PWA
// title bar when the app is installed, so a stray purple bar there was this value.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0B5FFF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
