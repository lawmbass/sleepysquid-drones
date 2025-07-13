import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import BookingsList from '@/components/admin/BookingsList';
import BookingStats from '@/components/admin/BookingStats';
import BookingFilters from '@/components/admin/BookingFilters';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import AdminSettings from '@/components/admin/AdminSettings';

export default function AdminContent({ user }) {
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

  // Update active section based on URL query
  useEffect(() => {
    const section = router.query.section || 'dashboard';
    setActiveSection(section);
    
    // Fetch data based on section
    if (section === 'dashboard' || section === 'bookings') {
      fetchBookings();
    }
  }, [router.query.section, filters]);

  const fetchBookings = async () => {
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

      const data = await response.json();
      setBookings(data.bookings || []);
      setStats(data.stats || {});
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load bookings. Please try again.');
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
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh bookings list
      fetchBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
      setError('Failed to update booking. Please try again.');
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
              <p className="text-gray-600">Welcome back, {user.name}. Here&apos;s what&apos;s happening with your drone services.</p>
            </div>
            
            <BookingStats stats={stats} />
            
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Bookings</h2>
              </div>
              <BookingsList 
                bookings={bookings.slice(0, 5)} 
                onUpdateBooking={updateBooking}
                loading={loading}
                error={error}
                compact={true}
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
              onPageChange={handlePageChange}
              loading={loading}
              error={error}
            />
          </div>
        );
      
      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-gray-600">Track performance metrics and business insights.</p>
            </div>
            
            <AdminAnalytics user={user} />
          </div>
        );
      
      case 'settings':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Configure system settings and preferences.</p>
            </div>
            
            <AdminSettings user={user} />
          </div>
        );
      
      case 'users':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600">Manage user accounts and permissions.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-500">User management features are in development.</p>
              </div>
            </div>
          </div>
        );
      
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