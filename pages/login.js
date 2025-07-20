import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiMail, FiUser, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Helper function to translate NextAuth error codes to user-friendly messages
  const getErrorMessage = (errorCode) => {
    const errorMessages = {
      'Callback': 'Authentication failed. Please try again.',
      'OAuthCallback': 'Google authentication failed. Please try again.',
      'OAuthSignin': 'Unable to sign in with Google. Please try again.',
      'OAuthCreateAccount': 'Unable to create account. Please try again.',
      'EmailCreateAccount': 'Unable to create account with this email.',
      'Signin': 'Sign in failed. Please try again.',
      'OAuthAccountNotLinked': 'This email is already associated with another account.',
      'EmailSignin': 'Unable to send sign in email.',
      'CredentialsSignin': 'Invalid credentials.',
      'SessionRequired': 'Please sign in to access this page.',
      'AccessDenied': 'Access denied. You may not have permission to access this resource.',
      'Verification': 'Verification failed. Please try again.',
      'Default': 'An authentication error occurred. Please try again.'
    };
    
    return errorMessages[errorCode] || errorMessages['Default'];
  };

  useEffect(() => {
    // Check for auth errors from URL params
    if (router.query.auth_error) {
      const errorCode = decodeURIComponent(router.query.auth_error);
      setError(getErrorMessage(errorCode));
    }
    
    // Check for email change success message
    if (router.query.message === 'email-changed' && router.query.new_email) {
      const newEmail = decodeURIComponent(router.query.new_email);
      setSuccessMessage(`Email changed successfully to ${newEmail}! Please sign in with your new email.`);
      
      // Clear the query parameters to prevent the message from persisting
      router.replace('/login', undefined, { shallow: true });
    }
    
    // If already signed in, redirect based on user role
    if (session?.user) {
      const redirectTo = router.query.callbackUrl || getDefaultRedirectForUser(session.user);
      router.push(redirectTo);
    }
  }, [session, router]);

  // Determine where to redirect users based on their role
  const getDefaultRedirectForUser = () => {
    // Everyone goes to the unified dashboard page
    return '/dashboard';
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Get callback URL from query params or determine default
      const callbackUrl = router.query.callbackUrl || '/dashboard';
      
      // Use standard NextAuth signin with redirect
      await signIn('google', {
        callbackUrl,
      });
    } catch (error) {
      console.error('Sign in error:', error);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Login - SleepySquid Drones</title>
        <meta name="description" content="Login to access your SleepySquid Drones account" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="absolute top-6 left-6">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors">
            <FiArrowLeft className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
        </div>
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="bg-blue-600 rounded-full p-3">
              <FiUser className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your dashboard and manage your drone services
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
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
                  <FiMail className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <div className="text-sm text-green-700">{successMessage}</div>
                </div>
              </div>
            )}
            
            <div>
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <FiMail className="h-4 w-4 mr-2" />
                    Sign in with Google
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Secure authentication
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                New to SleepySquid Drones? Sign in with your Google account to get started.
                Contact support if you need assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}