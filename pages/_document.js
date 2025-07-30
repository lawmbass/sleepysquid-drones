import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Viewport meta tag for mobile responsiveness */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        
        {/* Favicon using data URI to avoid 404 errors */}
        <link 
          rel="icon" 
          type="image/svg+xml" 
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%231e40af'/%3E%3Cg transform='translate(8,10)'%3E%3Crect x='6' y='6' width='4' height='3' fill='white' rx='1'/%3E%3Ccircle cx='2' cy='3' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='14' cy='3' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='2' cy='13' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='14' cy='13' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Cline x1='6' y1='7.5' x2='2' y2='3' stroke='white' stroke-width='0.5'/%3E%3Cline x1='10' y1='7.5' x2='14' y2='3' stroke='white' stroke-width='0.5'/%3E%3Cline x1='6' y1='7.5' x2='2' y2='13' stroke='white' stroke-width='0.5'/%3E%3Cline x1='10' y1='7.5' x2='14' y2='13' stroke='white' stroke-width='0.5'/%3E%3C/g%3E%3C/svg%3E"
        />
        {/* Fallback favicon for older browsers */}
        <link 
          rel="shortcut icon" 
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%231e40af'/%3E%3Cg transform='translate(8,10)'%3E%3Crect x='6' y='6' width='4' height='3' fill='white' rx='1'/%3E%3Ccircle cx='2' cy='3' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='14' cy='3' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='2' cy='13' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='14' cy='13' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Cline x1='6' y1='7.5' x2='2' y2='3' stroke='white' stroke-width='0.5'/%3E%3Cline x1='10' y1='7.5' x2='14' y2='3' stroke='white' stroke-width='0.5'/%3E%3Cline x1='6' y1='7.5' x2='2' y2='13' stroke='white' stroke-width='0.5'/%3E%3Cline x1='10' y1='7.5' x2='14' y2='13' stroke='white' stroke-width='0.5'/%3E%3C/g%3E%3C/svg%3E"
        />
        
        {/* Meta tags for better SEO and PWA support */}
        <meta name="theme-color" content="#1e40af" />
        <meta name="msapplication-TileColor" content="#1e40af" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SleepySquid Drones" />
        
        {/* Apple touch icons using data URI */}
        <link 
          rel="apple-touch-icon" 
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' fill='%231e40af' rx='20'/%3E%3Cg transform='translate(45,55) scale(2.8)'%3E%3Crect x='6' y='6' width='4' height='3' fill='white' rx='1'/%3E%3Ccircle cx='2' cy='3' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='14' cy='3' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='2' cy='13' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='14' cy='13' r='2' fill='none' stroke='white' stroke-width='0.5'/%3E%3Cline x1='6' y1='7.5' x2='2' y2='3' stroke='white' stroke-width='0.5'/%3E%3Cline x1='10' y1='7.5' x2='14' y2='3' stroke='white' stroke-width='0.5'/%3E%3Cline x1='6' y1='7.5' x2='2' y2='13' stroke='white' stroke-width='0.5'/%3E%3Cline x1='10' y1='7.5' x2='14' y2='13' stroke='white' stroke-width='0.5'/%3E%3C/g%3E%3C/svg%3E"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 