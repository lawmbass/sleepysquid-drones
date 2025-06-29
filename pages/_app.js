import '@/styles/globals.css';
import { DarkModeProvider } from '@/components/layout/DarkModeContext';

export default function App({ Component, pageProps }) {
  return (
    <DarkModeProvider>
      <Component {...pageProps} />
    </DarkModeProvider>
  );
} 