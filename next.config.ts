import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // SKU images are submitted through a multipart Server Action. Leave room
    // above the 6 MB Storage limit for multipart boundaries and form fields.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
