import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminContent from '@/components/dashboard/AdminContent';
import ClientContent from '@/components/dashboard/ClientContent';
import PilotContent from '@/components/dashboard/PilotContent';
import DefaultContent from '@/components/dashboard/DefaultContent';
// Removed adminConfig import as it's no longer needed

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Check if user is admin (backward compatibility)
  // const isAdmin = session?.user?.isAdmin || adminConfig.isAdmin(session?.user?.email);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/dashboard'));
    } else if (status === 'authenticated') {
      // Check if user has access
      if (session?.user?.hasAccess === false) {
        // Allow admins to bypass access check
        const isAdmin = session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com');
        if (!isAdmin) {
          router.push('/access-denied?reason=inactive');
          return;
        }
      }
      setLoading(false);
    }
  }, [status, router, session]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  // Show loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!session) {
    return null;
  }

  // Get user role
  const userRole = session.user.role || 'user';

  // Render appropriate dashboard content based on role
  const renderDashboardContent = () => {
    switch (userRole) {
      case 'admin':
        return <AdminContent user={session.user} />;
      case 'client':
        return <ClientContent user={session.user} />;
      case 'pilot':
        return <PilotContent user={session.user} />;
      default:
        return <DefaultContent user={session.user} />;
    }
  };

  // Get page title based on role
  const getPageTitle = () => {
    switch (userRole) {
      case 'admin':
        return 'Admin Dashboard - SleepySquid Drones';
      case 'client':
        return 'Client Portal - SleepySquid Drones';
      case 'pilot':
        return 'Pilot Dashboard - SleepySquid Drones';
      default:
        return 'Dashboard - SleepySquid Drones';
    }
  };

  return (
    <>
      <Head>
        <title>{getPageTitle()}</title>
        <meta name="description" content="Dashboard for SleepySquid Drones users" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <DashboardLayout 
        user={session.user} 
        onSignOut={handleSignOut}
        userRole={userRole}
      >
        {renderDashboardContent()}
      </DashboardLayout>
    </>
  );
}

// Server-side props for authentication
export async function getServerSideProps() {
  return {
    props: {
      // This ensures the page is always server-side rendered
      // which is good for authenticated pages
    }
  };
}