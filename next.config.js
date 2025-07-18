const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Google OAuth images - multiple subdomains
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh7.googleusercontent.com',
      },
      // Twitter/X images
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'si0.twimg.com',
      },
      // GitHub avatars
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars0.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars1.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars2.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars3.githubusercontent.com',
      },
      // Facebook images
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
        hostname: 'scontent.fcdn.net',
      },
      // LinkedIn images
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
      // Discord images
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      // Microsoft/Azure AD images
      {
        protocol: 'https',
        hostname: 'graph.microsoft.com',
      },
      // Other common image hosts
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'logos-world.net',
      },
      // Generic patterns for common CDNs
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.twimg.com',
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
    // Allow unoptimized images as fallback
    unoptimized: false,
    // Dangerously allow SVG
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

  },
};

module.exports = nextConfig;
