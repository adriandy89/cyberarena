import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Standalone output for the Docker production image (phase 008).
  output: 'standalone',
  // @repo/ui is an internal package shipping TypeScript source.
  transpilePackages: ['@repo/ui'],
  // Proxy the API from the web origin so browser requests (and the session
  // cookie) stay first-party in dev; in prod the reverse proxy unifies the
  // domain anyway (ADR-008). API_URL is server-side only.
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
