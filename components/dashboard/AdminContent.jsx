import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import BookingsList from '@/components/admin/BookingsList';
import BookingStats from '@/components/admin/BookingStats';
import BookingFilters from '@/components/admin/BookingFilters';
import Analytics from '@/components/admin/Analytics';
import Settings from './Settings';
import UserManagement from '@/components/admin/UserManagement';
import AccessStatusBanner from './AccessStatusBanner';
// Note: AdminSettings is now an inline component within this file

export default function AdminContent({ user, onUpdate }) {
  // Check if user is SleepySquid admin
  const isSleepySquidAdmin = user?.email?.toLowerCase()?.endsWith('@sleepysquid.com') || false;
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('dashboard');
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

  // Handle redirect for non-SleepySquid admins trying to access user management
  useEffect(() => {
    if (activeSection === 'users' && !isSleepySquidAdmin) {
      const redirectTimer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
      // Cleanup timeout on unmount or when dependencies change
      return () => clearTimeout(redirectTimer);
    }
  }, [activeSection, isSleepySquidAdmin, router]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/admin/bookings?${queryParams}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const response_data = await response.json();
      // Handle nested API response structure: response.data.bookings, response.data.stats, etc.
      const data = response_data.data || response_data;
      setBookings(data.bookings || []);
      setStats(data.stats || {});
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Update active section based on URL query
  useEffect(() => {
    const section = router.query.section || 'dashboard';
    setActiveSection(section);
    
    // Fetch data based on section
    if (section === 'dashboard' || section === 'bookings') {
      fetchBookings();
    }
  }, [router.query.section, fetchBookings]);

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
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh bookings list
      fetchBookings();
      return true;
    } catch (error) {
      console.error('Error updating booking:', error);
      setError('Failed to update booking. Please try again.');
      return false;
    }
  };

  const onDeleteBooking = async (bookingId) => {
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh bookings list
      fetchBookings();
      return true;
    } catch (error) {
      console.error('Error deleting booking:', error);
      setError('Failed to delete booking. Please try again.');
      return false;
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <AccessStatusBanner user={user} />
            
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
              <p className="text-gray-600">Welcome back, {user.name}. Here&apos;s what&apos;s happening with your drone services.</p>
            </div>
            
            <BookingStats stats={stats} user={user} />
            
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Bookings</h2>
              </div>
              <BookingsList 
                bookings={bookings.slice(0, 5)} 
                pagination={pagination}
                onUpdateBooking={updateBooking}
                onDeleteBooking={onDeleteBooking}
                loading={loading}
                error={error}
              />
            </div>
          </div>
        );
      
      case 'bookings':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
              <p className="text-gray-600">Manage all customer bookings and service requests.</p>
            </div>
            
            <BookingFilters 
              filters={filters} 
              onFilterChange={handleFilterChange}
            />
            
            <BookingsList 
              bookings={bookings}
              pagination={pagination}
              onUpdateBooking={updateBooking}
              onDeleteBooking={onDeleteBooking}
              onPageChange={handlePageChange}
              loading={loading}
              error={error}
            />
          </div>
        );
      
      case 'analytics':
        return <Analytics />;
      
      case 'settings':
        return <Settings user={user} onUpdate={onUpdate} />;
      
      case 'users':
        if (!isSleepySquidAdmin) {
          return (
            <div className="space-y-6">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                <p className="text-gray-600">You don&apos;t have permission to access user management.</p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-md p-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Access Restricted
                    </h3>
                    <p className="mt-1 text-sm text-red-700">
                      User management is restricted to SleepySquid administrators only. You will be redirected to the dashboard shortly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return <UserManagement />;
      
      default:
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome to your admin dashboard.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Section Not Found</h3>
                <p className="text-gray-500">The requested section could not be found.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-full">
      {renderContent()}
    </div>
  );
}