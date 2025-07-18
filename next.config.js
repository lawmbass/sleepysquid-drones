const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'logos-world.net',
      },
      // Additional OAuth provider domains
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
      },
      {
        protocol: 'https',
        hostname: 'scontent.xx.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'graph.facebook.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'si0.twimg.com',
      },
      // Microsoft/LinkedIn
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'media-exp1.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'media-exp2.licdn.com',
      },
      // Discord
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      // Generic CDN patterns that might be used
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
    // Optimize external images better
    minimumCacheTTL: 60,
    formats: ['image/webp', 'image/avif'],
    // Better image optimization for large files
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Loader optimization
    loader: 'default',
    path: '/_next/image',

  },
};

module.exports = nextConfig;
