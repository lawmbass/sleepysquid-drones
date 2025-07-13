import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLogin() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new generic login page with admin callback
    router.replace('/login?callbackUrl=' + encodeURIComponent('/admin'));
  }, [router]);

  return (
    <>
      <Head>
        <title>Redirecting to Login - SleepySquid Drones</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    </>
  );
} 