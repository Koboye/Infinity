import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_NAME: 'Infinity', NEXT_PUBLIC_APP_VERSION: pkg.version },
  async redirects() { return [{ source: '/games/exam-prep/index.html', destination: '/', permanent: false }]; },
  async headers() {
    const dev = process.env.NODE_ENV !== 'production';
    const sharedHeaders = [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }, // Google sign-in popup keeps working
        ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
        { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval' " : ''}https://apis.google.com https://www.gstatic.com`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          `img-src 'self' data: blob: https: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://storage.googleapis.com ${process.env.NEXT_PUBLIC_ADS_IMG_HOSTS || ''}`.trim(),   // v64: any https picture (sanitizeAd already forces https). A host the policy blocked made its ad fail silently, so "two ads, one shows"; images cannot run code
          "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
          "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; ') },
      ];
    // Only the embedded game pages may be framed by Infinity itself.
    // Every other route retains DENY / frame-ancestors none.
    return [
      { source: '/games/:path*', headers: sharedHeaders.map(h =>
        h.key === 'Content-Security-Policy'
          ? { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") }
          : h
      ).concat([{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]) },
      { source: '/((?!games/).*)', headers: sharedHeaders.concat([{ key: 'X-Frame-Options', value: 'DENY' }]) },
    ];
  },
};
export default nextConfig;
