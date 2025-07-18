import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { FiUser, FiCheck, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';

export default function InvitePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [invitationData, setInvitationData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If already signed in, redirect to dashboard
    if (session?.user) {
      router.push('/dashboard');
      return;
    }

    const { token } = router.query;
    
    if (token) {
      // In a real implementation, you'd validate the token against your database
      // For now, we'll decode basic info from the token or use mock data
      
      // Mock invitation data (in production, fetch from database using token)
      const mockInvitationData = {
        name: 'Guest User',
        email: 'guest@example.com',
        role: 'client',
        invitedBy: 'Admin',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        token: token
      };
      
      setInvitationData(mockInvitationData);
      setLoading(false);
    } else {
      setError('Invalid invitation link. The invitation token is missing.');
      setLoading(false);
    }
  }, [router.query, session]);

  const handleAcceptInvitation = async () => {
    setLoading(true);
    setError('');

    try {
      // Sign in with Google and pass the invitation token
      await signIn('google', {
        callbackUrl: `/dashboard?invite=${invitationData.token}`,
      });
    } catch (error) {
      console.error('Invitation sign-in error:', error);
      setError('Failed to process invitation. Please try again.');
      setLoading(false);
    }
  };

  const getRoleDescription = (role) => {
    const descriptions = {
      'admin': 'Administrator with full system access',
      'pilot': 'Pilot with mission management capabilities',
      'client': 'Client with booking and project management access',
      'user': 'User with basic platform access'
    };
    return descriptions[role] || 'Platform user';
  };

  const getRoleColor = (role) => {
    const colors = {
      'admin': 'bg-red-100 text-red-800',
      'pilot': 'bg-blue-100 text-blue-800',
      'client': 'bg-green-100 text-green-800',
      'user': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Invalid Invitation - SleepySquid Drones</title>
        </Head>
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="text-center">
                <FiAlertCircle className="mx-auto h-12 w-12 text-red-400" />
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                  Invalid Invitation
                </h2>
                <p className="mt-2 text-sm text-gray-600">{error}</p>
                <div className="mt-6">
                  <Link 
                    href="/"
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    ← Back to Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Join SleepySquid Drones - Invitation</title>
        <meta name="description" content="Accept your invitation to join SleepySquid Drones" />
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
            You're Invited!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join SleepySquid Drones and start managing your drone services
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            
            {/* Invitation Details */}
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FiCheck className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      You've been invited as a:
                    </p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(invitationData.role)}`}>
                        {invitationData.role.charAt(0).toUpperCase() + invitationData.role.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      {getRoleDescription(invitationData.role)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sign In Button */}
            <div>
              <button
                onClick={handleAcceptInvitation}
                disabled={loading}
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Accept Invitation & Sign In
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
                    Secure Google Authentication
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By accepting this invitation, you agree to our terms of service.
                You'll be signed in with your Google account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}