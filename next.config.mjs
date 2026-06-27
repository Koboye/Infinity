/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'Dagu',
    NEXT_PUBLIC_APP_VERSION: '5.0.0',
  },
};
export default nextConfig;
