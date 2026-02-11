/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@crypto-stake/shared', '@crypto-stake/ui'],
  images: {
    domains: ['localhost'],
    remotePatterns: [
      { protocol: 'https', hostname: 'cryptologos.cc' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
