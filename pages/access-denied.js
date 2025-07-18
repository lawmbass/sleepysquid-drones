import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { FiAlertCircle, FiLogOut, FiHome, FiMail } from 'react-icons/fi';

export default function AccessDenied() {
  const { data: session } = useSession();
  const router = useRouter();
  const [reason, setReason] = useState('');

  useEffect(() => {
    // Get the reason from query params
    const { reason: queryReason } = router.query;
    setReason(queryReason || 'access');
  }, [router.query]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const getContent = () => {
    switch (reason) {
      case 'inactive':
        return {
          title: 'Account Inactive',
          message: 'Your account has been temporarily suspended. Please contact an administrator to reactivate your account.',
          details: 'Your account access has been disabled by an administrator. This could be due to policy violations, security concerns, or administrative requirements.',
          icon: FiAlertCircle,
          iconColor: 'text-orange-500',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      default:
        return {
          title: 'Access Denied',
          message: 'You do not have permission to access this resource.',
          details: 'Please contact an administrator if you believe this is an error.',
          icon: FiAlertCircle,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <>
      <Head>
        <title>Access Denied - SleepySquid Drones</title>
        <meta name="description" content="Access denied to this resource" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${content.bgColor}`}>
                <Icon className={`h-6 w-6 ${content.iconColor}`} />
              </div>
              
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                {content.title}
              </h2>
              
              <div className={`mt-6 p-4 rounded-md ${content.bgColor} ${content.borderColor} border`}>
                <p className="text-sm text-gray-700">
                  {content.message}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  {content.details}
                </p>
              </div>

              {session && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        {session.user.image ? (
                          <Image 
                            className="h-8 w-8 rounded-full" 
                            src={session.user.image} 
                            alt={session.user.name}
                            width={32}
                            height={32}
                          />
                        ) : (
                          <span className="text-blue-600 font-medium text-sm">
                            {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-blue-900">
                        Signed in as {session.user.name || session.user.email}
                      </p>
                      <p className="text-sm text-blue-700">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {session ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <FiLogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Sign In
                  </button>
                )}
                
                <button
                  onClick={handleGoHome}
                  className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FiHome className="h-4 w-4 mr-2" />
                  Go to Home
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Need help? Contact support:
                  </p>
                  <a
                    href="mailto:support@sleepysquid.com"
                    className="mt-2 inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
                  >
                    <FiMail className="h-4 w-4 mr-1" />
                    support@sleepysquid.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// This page doesn't require authentication
export async function getServerSideProps() {
  return {
    props: {}
  };
}