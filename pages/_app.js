import '@/styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { DarkModeProvider } from '@/components/layout/DarkModeContext';
import Head from 'next/head';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </Head>
      <SessionProvider session={session}>
        <DarkModeProvider>
          <Component {...pageProps} />
        </DarkModeProvider>
      </SessionProvider>
    </>
  );
} 