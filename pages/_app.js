import '@/styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { DarkModeProvider } from '@/components/layout/DarkModeContext';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <DarkModeProvider>
        <Component {...pageProps} />
      </DarkModeProvider>
    </SessionProvider>
  );
} 