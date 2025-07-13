import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import BookingsList from '@/components/admin/BookingsList';
import BookingStats from '@/components/admin/BookingStats';
import BookingFilters from '@/components/admin/BookingFilters';
import { adminConfig } from '@/libs/adminConfig';

function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    status: '',
    service: '',
    page: 1,
    limit: 20,
    sort: '-createdAt'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if user is admin
  const isAdmin = session?.user?.isAdmin || adminConfig.isAdmin(session?.user?.email);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/admin'));
    } else if (session && !isAdmin) {
      // If user is not admin, redirect to their appropriate dashboard
      const redirectUrl = session.user.role === 'client' ? '/client/dashboard' : '/dashboard';
      router.push(redirectUrl);
    } else if (session && isAdmin) {
      fetchBookings();
    }
  }, [status, session, isAdmin, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/admin/bookings?${queryParams}`, {
        credentials: 'include', // Include session cookies for authentication
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setBookings(data.data.bookings);
      setStats(data.data.stats);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const updateBooking = async (bookingId, updates) => {
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies for authentication
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update booking');
      }

      // Refresh bookings list
      fetchBookings();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  // Authentication checks
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

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Login Required</h1>
          <p className="text-gray-600 text-center mb-6">
            Only authorized administrators can access this area.
          </p>
          <button
            onClick={() => signIn()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don&apos;t have permission to access this admin area.</p>
          <p className="text-sm text-gray-500 mb-6">
            Signed in as: {session.user.email}
          </p>
          <button
            onClick={() => signOut()}
            className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard - Sleepy Squid Drones</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <AdminLayout user={session.user} onSignOut={() => signOut()}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Bookings Dashboard</h1>
            <button
              onClick={fetchBookings}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <BookingStats stats={stats} />
          
          <BookingFilters 
            filters={filters} 
            onFilterChange={handleFilterChange}
          />

          <BookingsList
            bookings={bookings}
            pagination={pagination}
            loading={loading}
            onPageChange={handlePageChange}
            onUpdateBooking={updateBooking}
          />
        </div>
      </AdminLayout>
    </>
  );
}

// This page requires authentication and should not be statically generated
export async function getServerSideProps() {
  return {
    props: {}, // Empty props, we'll handle auth on client side
  };
}

AdminDashboard.displayName = 'AdminPage';
export default AdminDashboard; 