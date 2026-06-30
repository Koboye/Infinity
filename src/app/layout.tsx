// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import { AuthBootstrap } from '@/components/AuthBootstrap';
import { LocaleSync } from '@/components/LocaleSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

// ✅ SEO METADATA - ADD HERE
export const metadata: Metadata = {
  title: 'Infinity - Ethiopia\'s Social Platform',
  description: 'Connect, share, and discover with the Ethiopian community on Infinity.',
  keywords: 'social media, ethiopia, community, sharing, videos, photos, Ethiopian content',
  authors: [{ name: 'Infinity Team' }],
  creator: 'Infinity',
  publisher: 'Infinity',
  
  openGraph: {
    title: 'Infinity - Ethiopia\'s Social Platform',
    description: 'Join the community and start sharing your story.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://infinity.vercel.app',
    siteName: 'Infinity',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://infinity.vercel.app'}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Infinity - Ethiopia\'s Social Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'Infinity - Ethiopia\'s Social Platform',
    description: 'Join the community and start sharing your story.',
    images: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://infinity.vercel.app'}/og-image.png`],
    creator: '@infinity',
    site: '@infinity',
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ Google Analytics ID from environment variable
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <head>
        {/* ✅ Google Analytics - ADD HERE */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        
        {/* ✅ Additional meta tags for better SEO */}
        <meta name="theme-color" content="#3D6B4F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* ✅ Preconnect to external services */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>
            <AuthBootstrap>
              <LocaleSync />
              {children}
            </AuthBootstrap>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
