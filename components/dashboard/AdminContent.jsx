import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import BookingsList from '@/components/admin/BookingsList';
import BookingFilters from '@/components/admin/BookingFilters';
import Analytics from '@/components/admin/Analytics';
import Settings from './Settings';
import UserManagement from '@/components/admin/UserManagement';
import InvoicesSection from '@/components/admin/InvoicesSection';
import ClientsSection from '@/components/admin/ClientsSection';
import PromoManagement from '@/components/admin/PromoManagement';
import ListingsSection from '@/components/admin/ListingsSection';
import BotRulesSection from '@/components/admin/BotRulesSection';
import AddBookingForm from '@/components/admin/AddBookingForm';
import AirspaceSection from '@/components/admin/AirspaceSection';
import AccessStatusBanner from './AccessStatusBanner';
import HubOverview from '@/components/hub/HubOverview';
import { ServiceFilter } from '@/components/hub/ServiceChip';
import ServiceChip from '@/components/hub/ServiceChip';
import StripeCoupons from '@/components/hub/StripeCoupons';
import {
  OVERVIEW_STATUS_FILTERS,
  filterOverviewJobs,
  openGigsLabel,
  overviewStatusCounts,
} from '@/libs/jobs';
// Note: AdminSettings is now an inline component within this file

export default function AdminContent({ user, onUpdate }) {
  // Check if user is SleepySquid admin
  const isSleepySquidAdmin = Boolean(user?.isAdmin) || user?.email?.toLowerCase()?.endsWith('@sleepysquid.com') || false;
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [bookings, setBookings] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    status: '',
    service: '',
    service_line: '',
    page: 1,
    limit: 20,
    sort: '-createdAt'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overviewFilter, setOverviewFilter] = useState('all');

  // Handle redirect for non-SleepySquid admins trying to access user management
  useEffect(() => {
    if ((activeSection === 'users' || activeSection === 'invoices' || activeSection === 'clients') && !isSleepySquidAdmin) {
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
      setRecentJobs(data.recentJobs || []);
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
        const body = await response.json().catch(() => ({}));
        if (response.status === 400 && body?.message) return body.message;
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
      case 'dashboard': {
        const overviewCounts = overviewStatusCounts(recentJobs);
        const visibleJobs = filterOverviewJobs(recentJobs, overviewFilter);
        return (
          <div className="space-y-6">
            <AccessStatusBanner user={user} />
            
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-300">Welcome back, {user.name}. Here&apos;s what&apos;s happening across all SleepySquid services.</p>
              <button
                type="button"
                onClick={() => setOverviewFilter('open')}
                className={`mt-4 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ${
                  overviewFilter === 'open'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50'
                }`}
              >
                {openGigsLabel(overviewCounts.open)}
              </button>
            </div>

            <HubOverview />

            <Analytics />
            
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Bookings</h2>
              </div>
              <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Gig status">
                  {OVERVIEW_STATUS_FILTERS.map((chip) => {
                    const selected = overviewFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setOverviewFilter(chip.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                          selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {chip.label}
                        <span className={selected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}>{overviewCounts[chip.id] || 0}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <BookingsList 
                bookings={visibleJobs}
                pagination={{ totalPages: 1, totalCount: visibleJobs.length, currentPage: 1 }}
                onUpdateBooking={updateBooking}
                onDeleteBooking={onDeleteBooking}
                onGigUpdated={fetchBookings}
                loading={loading}
                error={error}
              />
            </div>
          </div>
        );
      }
      
      case 'bookings':
        return (
          <div className="space-y-6">
            <AddBookingForm onCreated={fetchBookings} />

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg px-4 sm:px-6 py-3">
              <ServiceFilter
                value={filters.service_line}
                onChange={(value) => handleFilterChange({ service_line: value })}
              />
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
              onGigUpdated={fetchBookings}
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
      
      case 'clients':
        if (!isSleepySquidAdmin) return <p className="text-sm text-gray-500">Clients are only available to SleepySquid admins. Redirecting…</p>;
        return <ClientsSection />;

      case 'invoices':
        if (!isSleepySquidAdmin) return <p className="text-sm text-gray-500">Invoices are only available to SleepySquid admins. Redirecting…</p>;
        return <InvoicesSection />;

      case 'users':
        if (!isSleepySquidAdmin) {
          return (
            <div className="space-y-6">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
                <p className="text-gray-600 dark:text-gray-300">You don&apos;t have permission to access user management.</p>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                      Access Restricted
                    </h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      User management is restricted to SleepySquid administrators only. You will be redirected to the dashboard shortly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return <UserManagement />;
      
      case 'promos':
        return (
          <div className="space-y-10">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promos</h1>
              <p className="text-gray-600 dark:text-gray-300">Discounts for every SleepySquid service, tagged by service.</p>
            </div>
            <StripeCoupons />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Drone booking site promos</h2>
                <ServiceChip id="drones" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Banner promos on drones.sleepysquid.com. They apply to drone bookings only.</p>
              <PromoManagement />
            </div>
          </div>
        );

      case 'listings':
        return <ListingsSection />;

      case 'bot-rules':
        return <BotRulesSection />;

      case 'airspace':
        return <AirspaceSection />;
      
      default:
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-300">Welcome to your admin dashboard.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Section Not Found</h3>
                <p className="text-gray-500 dark:text-gray-400">The requested section could not be found.</p>
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