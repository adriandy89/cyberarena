import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Standalone output for the Docker production image (phase 008).
  output: 'standalone',
  // @repo/ui is an internal package shipping TypeScript source.
  transpilePackages: ['@repo/ui'],
};

export default withNextIntl(nextConfig);
