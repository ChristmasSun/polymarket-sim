/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable caching globally
  generateEtags: false,
  // Add headers to prevent caching
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig 