/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Configure port 3003 for standalone operation
  async redirects() {
    return []
  },
  async rewrites() {
    return []
  },
  // Standard Next.js configuration for analytics dashboard
  typescript: {
    // Dangerously allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Only run ESLint on these directories during production builds
    dirs: ['app', 'components', 'lib', 'types'],
  },
}

module.exports = nextConfig
