import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiShield, FiLogIn } from 'react-icons/fi';

export default function AdminIndex() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Check if user is admin and redirect to dashboard
      if (session.user.isAdmin || session.user.role === 'admin') {
        router.replace('/dashboard');
      } else {
        // Non-admin user - redirect to main dashboard
        router.replace('/dashboard');
      }
    }
  }, [status, session, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin access...</p>
        </div>
      </div>
    );
  }

  // Show login prompt for unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <>
        <Head>
          <title>Admin Access - SleepySquid Drones</title>
          <meta name="description" content="Admin access for SleepySquid Drones" />
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-white shadow-lg rounded-lg p-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <FiShield className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="mt-4 text-2xl font-bold text-gray-900">Admin Access</h2>
                <p className="mt-2 text-gray-600">
                  Sign in to access the admin dashboard
                </p>
              </div>
              
              <div className="mt-8">
                <button
                  onClick={() => router.push('/login?callbackUrl=' + encodeURIComponent('/admin'))}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FiLogIn className="mr-2 h-4 w-4" />
                  Sign In
                </button>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Need admin access? Contact your administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // This should not be reached due to the redirect in useEffect
  return null;
} 