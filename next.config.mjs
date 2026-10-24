/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_NAME: 'Gebeta', NEXT_PUBLIC_APP_VERSION: '2.0.0' },
  async headers() {
    const dev = process.env.NODE_ENV !== 'production';
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval' " : ''}https://apis.google.com https://www.gstatic.com`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: https://lh3.googleusercontent.com",
          "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
          "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
          "object-src 'none'",
          "frame-ancestors 'none'",
        ].join('; ') },
      ],
    }];
  },
};
export default nextConfig;
