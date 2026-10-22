// Assets live under /drones-static so sleepysquid.com can proxy this app (dashboard, login, auth)
// without clashing with the marketing site's own /_next files. The rewrite below maps them back here.
const ASSET_PREFIX = '/drones-static';

// pdfkit loads its standard fonts (Helvetica.cjs etc.) with dynamic requires that Vercel's file tracing misses,
// so include them for the AI report PDF route.
const pdfAssets = ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/**/*.{cjs,js,afm,ttf,trie,json}'];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
    outputFileTracingIncludes: { '/api/user/ai-portal-pdf': pdfAssets },
  },
  assetPrefix: ASSET_PREFIX,
  // Old drones.sleepysquid.com/login links go to the shared sign-in (query, incl. from + callbackUrl, is kept).
  // Opt-in via CENTRAL_LOGIN_URL. Requests proxied from sleepysquid.com carry ?via=central and are not redirected.
  async redirects() {
    const central = process.env.CENTRAL_LOGIN_URL;
    if (!central) return [];
    return [{ source: '/login', has: [{ type: 'host', value: 'drones.sleepysquid.com' }], missing: [{ type: 'query', key: 'via' }], destination: central, permanent: false }];
  },
  async rewrites() {
    return { beforeFiles: [{ source: `${ASSET_PREFIX}/:path*`, destination: '/:path*' }] };
  },
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
    formats: ['image/avif', 'image/webp'],
    // Better image optimization for large files
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Loader optimization
    loader: 'default',
    path: `${ASSET_PREFIX}/_next/image`,
    // Allow unoptimized images as fallback
    unoptimized: false,
    // Dangerously allow SVG
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

  },
};

module.exports = nextConfig;
