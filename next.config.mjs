/** @type {import('next').NextConfig} */
const WORKER = process.env.NEXT_PUBLIC_DIMTS_WORKER_ORIGIN || ''; // GPU worker origin: HLS + dubbed MP4

export default {
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          `media-src 'self' blob: data: ${WORKER}`.trim(),
          `connect-src 'self' ${WORKER} https://*.googleapis.com https://api.cloudinary.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`.replace(/\s+/g, ' '),
          "font-src 'self' https://fonts.gstatic.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
          "object-src 'none'",
          'upgrade-insecure-requests',
        ].join('; ') },
      ],
    }];
  },
};
