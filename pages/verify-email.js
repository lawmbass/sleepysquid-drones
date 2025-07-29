import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiMail, FiAlertCircle, FiCheck, FiLoader } from 'react-icons/fi';

export default function VerifyEmail() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    // Get token from URL
    if (router.query.token) {
      setToken(router.query.token);
      verifyEmail(router.query.token);
    } else if (router.isReady) {
      setError('No verification token provided');
      setIsLoading(false);
    }
  }, [router.query.token, router.isReady]);

  const verifyEmail = async (verificationToken) => {
    try {
      const response = await fetch('/api/user/email/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(data.message || 'Email verification failed');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      setError('An error occurred while verifying your email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Verify Email - SleepySquid Drones</title>
        <meta name="description" content="Verify your email address for SleepySquid Drones" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="flex justify-center">
              <div className={`rounded-full p-3 ${
                isLoading ? 'bg-blue-600' : 
                error ? 'bg-red-600' : 'bg-green-600'
              }`}>
                {isLoading ? (
                  <FiLoader className="h-8 w-8 text-white animate-spin" />
                ) : error ? (
                  <FiAlertCircle className="h-8 w-8 text-white" />
                ) : (
                  <FiCheck className="h-8 w-8 text-white" />
                )}
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {isLoading ? 'Verifying your email...' : 
               error ? 'Verification failed' : 'Email verified!'}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {isLoading ? 'Please wait while we verify your email address' :
               error ? 'There was a problem verifying your email' :
               'Your account is now active'}
            </p>
          </div>

          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {isLoading && (
              <div className="text-center">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <FiAlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}
            
            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <FiCheck className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <div className="text-sm text-green-700">
                    {successMessage}
                    <br />
                    <span className="text-xs">Redirecting to sign in page...</span>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center space-y-4">
              {error && (
                <div className="space-y-2">
                  <Link href="/signup" className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                    Create New Account
                  </Link>
                  <Link href="/login" className="block text-blue-600 hover:text-blue-500 text-sm">
                    Back to Sign In
                  </Link>
                </div>
              )}

              {successMessage && (
                <Link href="/login" className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  Continue to Sign In
                </Link>
              )}

              {!isLoading && !error && !successMessage && (
                <Link href="/login" className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  Go to Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}