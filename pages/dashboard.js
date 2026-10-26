import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminContent from '@/components/dashboard/AdminContent';
import ClientContent from '@/components/dashboard/ClientContent';
import PilotContent from '@/components/dashboard/PilotContent';
import DefaultContent from '@/components/dashboard/DefaultContent';
import AiAutomationContent, { AiSummaryCard } from '@/components/aiPortal/AiAutomationContent';
import Settings from '@/components/dashboard/Settings';
import AiSettings from '@/components/aiPortal/AiSettings';

const ADMIN_SECTIONS = ['bookings', 'listings', 'bot-rules', 'airspace', 'promos', 'analytics', 'users', 'invoices'];

export default function Dashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const requestedSection = Array.isArray(router.query.section)
    ? router.query.section[0]
    : router.query.section;
  const isDashboardAdmin = Boolean(session?.user?.isAdmin) || session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/dashboard'));
    } else if (status === 'authenticated') {
      // Check if user has access
      if (session?.user?.hasAccess === false) {
        // Allow admins to bypass access check
        const isAdmin = isDashboardAdmin || session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com');
        if (!isAdmin) {
          router.push('/access-denied?reason=inactive');
          return;
        }
      }
      setLoading(false);
    }
  }, [status, router, session, isDashboardAdmin]);

  useEffect(() => {
    if (!router.isReady || status !== 'authenticated') return;
    // Old "Manage AI clients" links: AI clients are managed in User Management now.
    if (requestedSection === 'ai-admin') { router.replace(isDashboardAdmin ? '/dashboard?section=users' : '/dashboard'); return; }
    // Old "AI settings" links: AI settings are a section of Settings now.
    if (requestedSection === 'ai-settings') { router.replace('/dashboard?section=settings#ai-automation'); return; }
    if (isDashboardAdmin) return;
    if (requestedSection && ADMIN_SECTIONS.includes(requestedSection)) {
      router.replace('/dashboard');
    }
  }, [router, status, isDashboardAdmin, requestedSection]);

  // Scroll to the AI automation section of Settings when linked to it (it renders after its data loads).
  useEffect(() => {
    if (requestedSection !== 'settings' || typeof window === 'undefined' || window.location.hash !== '#ai-automation') return;
    let n = 0; const t = setInterval(() => { const el = document.querySelector('#ai-automation [data-testid=ai-settings]'); if (el || ++n > 40) { clearInterval(t); el?.closest('#ai-automation').scrollIntoView({ block: 'start' }); } }, 250);
    return () => clearInterval(t);
  }, [requestedSection]);

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

  if (!isDashboardAdmin && requestedSection && ADMIN_SECTIONS.includes(requestedSection)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Admin when the email matches ADMIN_EMAILS or @sleepysquid.com, or the stored role is admin.
  const userRole = isDashboardAdmin ? 'admin' : (session.user.role || 'client');

  // Handle user data updates
  const handleUserUpdate = async (updatedUser) => {
    try {
      // Update the session with new user data
      await update({
        ...session,
        user: updatedUser
      });
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  // Render appropriate dashboard content based on role
  const showAi = Boolean(session.user.aiClient) || isDashboardAdmin;
  const renderDashboardContent = () => {
    if (requestedSection === 'ai' && showAi) return <AiAutomationContent />;
    const roleContent = renderRoleContent();
    // AI automation settings live in Settings, for users linked to an AI client (not admins' own Settings).
    if (requestedSection === 'settings' && session.user.aiClient && !isDashboardAdmin) {
      return (<>{String(session.user.id || '').startsWith('ai:') ? <Settings user={session.user} onUpdate={handleUserUpdate} /> : roleContent}<div id="ai-automation" className="mt-8 scroll-mt-4"><AiSettings /></div></>);
    }
    if (session.user.aiClient && !requestedSection) {
      return (<><AiSummaryCard onOpen={() => router.push('/dashboard?section=ai', undefined, { shallow: true })} />{String(session.user.id || '').startsWith('ai:') ? null : roleContent}</>);
    }
    return roleContent;
  };
  const renderRoleContent = () => {
    switch (userRole) {
      case 'admin':
        return <AdminContent user={session.user} onUpdate={handleUserUpdate} />;
      case 'client':
        return <ClientContent user={session.user} onUpdate={handleUserUpdate} />;
      case 'pilot':
        return <PilotContent user={session.user} onUpdate={handleUserUpdate} />;
      default:
        return <DefaultContent user={session.user} onUpdate={handleUserUpdate} />;
    }
  };

  // Get page title based on role
  const getPageTitle = () => {
    if (requestedSection === 'ai' && showAi) return 'AI automation - SleepySquid';
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