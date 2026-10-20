import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Viewport meta tag for mobile responsiveness */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        
        {/* SleepySquid Drones brand icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:image" content="https://drones.sleepysquid.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://drones.sleepysquid.com/og-image.png" />

        {/* Meta tags for better SEO and PWA support */}
        <meta name="theme-color" content="#1C69AD" />
        <meta name="msapplication-TileColor" content="#1C69AD" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SleepySquid Drones" />
        
        
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 