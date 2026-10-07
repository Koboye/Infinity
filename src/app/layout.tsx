import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dimts · ድምጽ',
  description: "Hear the world in Amharic. In every speaker's own voice.",
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, themeColor: '#0B5FFF' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
