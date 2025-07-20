import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import { FiCheck, FiX, FiLoader } from 'react-icons/fi';

export default function VerifyEmailChange() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { token } = router.query;
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [hasVerified, setHasVerified] = useState(false); // Prevent duplicate API calls

  useEffect(() => {
    if (token && !hasVerified) {
      console.log('Token received, starting verification process...');
      setHasVerified(true); // Mark as started to prevent duplicates
      
      const verifyEmailChange = async () => {
        try {
          console.log('Making email verification API call...');
          const response = await fetch('/api/user/email/verify-change', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });

          const data = await response.json();

          if (response.ok) {
            setStatus('success');
            setMessage(data.message);
            setNewEmail(data.newEmail);
            
            // Force logout and redirect to login to prevent session mismatch issues
            if (data.sessionRefreshRequired) {
              setIsRefreshingSession(true);
              try {
                console.log('Email change successful - forcing fresh login to prevent session issues...');
                
                // Sign out to clear stale session
                await signOut({ redirect: false });
                
                // Redirect to login with success message
                setTimeout(() => {
                  router.push('/login?message=email-changed&new_email=' + encodeURIComponent(data.newEmail));
                }, 1500);
              } catch (error) {
                console.error('Error during logout:', error);
                // Fallback: redirect to dashboard anyway
                setTimeout(() => {
                  router.push('/dashboard?section=settings');
                }, 3000);
              } finally {
                setIsRefreshingSession(false);
              }
            } else {
              // Redirect normally if no session refresh needed
              setTimeout(() => {
                router.push('/dashboard?section=settings');
              }, 5000);
            }
          } else {
            setStatus('error');
            setMessage(data.message || 'Verification failed');
            setNewEmail(''); // Clear any stale email data
            setIsRefreshingSession(false); // Ensure no refresh state
            // Explicitly do NOT redirect on verification failure - stay on error page
            console.log('Email verification failed, staying on error page');
            return; // Exit early to prevent any further processing
          }
        } catch (error) {
          setStatus('error');
          setMessage('An error occurred while verifying your email change');
          setNewEmail(''); // Clear any stale email data
          setIsRefreshingSession(false); // Ensure no refresh state
          console.log('Email verification error, staying on error page');
        }
      };
      
      verifyEmailChange();
    }
  }, [token, hasVerified, router]); // Simple dependencies

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <FiLoader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Verifying Email Change
                </h2>
                <p className="mt-2 text-gray-600">
                  Please wait while we verify your new email address...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <FiCheck className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Email Changed Successfully!
                </h2>
                <p className="mt-2 text-gray-600">
                  {message}
                </p>
                {newEmail && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Your new email address: <strong>{newEmail}</strong>
                    </p>
                  </div>
                )}
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> Please use your new email address for future logins.
                  </p>
                </div>
                {isRefreshingSession ? (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FiLoader className="h-4 w-4 text-blue-600 animate-spin" />
                      <p className="text-sm text-blue-800">
                        Signing you out and redirecting to login for a fresh session...
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">
                    Redirecting in a few seconds...
                  </p>
                )}
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <FiX className="h-6 w-6 text-red-600" />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Email Change Failed
                </h2>
                <p className="mt-2 text-gray-600">
                  {message}
                </p>
                {message.includes('expired') && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Token expired:</strong> Email change verification links expire after 24 hours. 
                      Please go to Settings and request a new email change if you still want to change your email address.
                    </p>
                  </div>
                )}
                <div className="mt-6 space-y-4">
                  <button
                    onClick={() => router.push('/dashboard?section=settings')}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Settings
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}