
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/email-hub/:path*',
        destination: `${process.env.EMAIL_HUB_URL || 'http://localhost:5001'}/email-hub/:path*`,
      },
      {
        source: '/push-blaster/:path*',
        destination: `${process.env.PUSH_BLASTER_URL || 'http://localhost:3001'}/push-blaster/:path*`,
      },
      {
        source: '/analytics-dashboard/:path*',
        destination: `${process.env.ANALYTICS_DASHBOARD_URL || 'http://localhost:3003'}/analytics-dashboard/:path*`,
      },
      {
        source: '/push-cadence/:path*',
        destination: `${process.env.PUSH_CADENCE_URL || 'http://localhost:3002'}/push-cadence/:path*`,
      },
    ];
  },
};

export default nextConfig; 