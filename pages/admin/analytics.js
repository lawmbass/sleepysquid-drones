import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import { FiTrendingUp, FiDollarSign, FiCalendar, FiUsers, FiMap } from 'react-icons/fi';
import { adminConfig } from '@/libs/adminConfig';

function AdminAnalytics() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState({
    monthlyStats: [],
    serviceBreakdown: [],
    revenueOverTime: [],
    popularLocations: [],
    loading: true
  });

  // Check if user is admin
  const isAdmin = session?.user?.isAdmin || adminConfig.isAdmin(session?.user?.email);

  // Redirect to unified dashboard
  useEffect(() => {
    if (session) {
      router.push('/dashboard?section=analytics');
    }
  }, [session, router]);

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
    router.push('/login?callbackUrl=' + encodeURIComponent('/dashboard?section=analytics'));
    return null;
  }

  if (!isAdmin) {
    // Redirect non-admins to dashboard
    router.push('/dashboard');
    return null;
  }

  const fetchAnalytics = async () => {
    try {
      // For now, using mock data - you can replace with real API calls
      setAnalytics({
        monthlyStats: [
          { month: 'Jan', bookings: 12, revenue: 4800 },
          { month: 'Feb', bookings: 19, revenue: 7200 },
          { month: 'Mar', bookings: 25, revenue: 9800 },
          { month: 'Apr', bookings: 31, revenue: 12400 },
          { month: 'May', bookings: 28, revenue: 11200 },
          { month: 'Jun', bookings: 35, revenue: 14000 }
        ],
        serviceBreakdown: [
          { service: 'Real Estate', count: 45, percentage: 35 },
          { service: 'Aerial Photography', count: 32, percentage: 25 },
          { service: 'Inspections', count: 28, percentage: 22 },
          { service: 'Event Coverage', count: 15, percentage: 12 },
          { service: 'Mapping', count: 8, percentage: 6 }
        ],
        popularLocations: [
          { location: 'Downtown Area', count: 23 },
          { location: 'Suburban Districts', count: 18 },
          { location: 'Industrial Zone', count: 12 },
          { location: 'Coastal Region', count: 9 },
          { location: 'Rural Areas', count: 6 }
        ],
        loading: false
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(prev => ({ ...prev, loading: false }));
    }
  };

  const { monthlyStats, serviceBreakdown, popularLocations, loading } = analytics;

  const totalBookings = monthlyStats.reduce((sum, month) => sum + month.bookings, 0);
  const totalRevenue = monthlyStats.reduce((sum, month) => sum + month.revenue, 0);
  const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  if (loading) {
    return (
      <AdminLayout user={session.user} onSignOut={() => signOut()}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Analytics - Admin Dashboard</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <AdminLayout user={session.user} onSignOut={() => signOut()}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <button
              onClick={fetchAnalytics}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-3 bg-blue-500 rounded-lg">
                  <FiCalendar className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Bookings (6M)</p>
                  <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-3 bg-green-500 rounded-lg">
                  <FiDollarSign className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Revenue (6M)</p>
                  <p className="text-2xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-3 bg-purple-500 rounded-lg">
                  <FiTrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Avg Booking Value</p>
                  <p className="text-2xl font-bold text-gray-900">${avgBookingValue.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Trends */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Trends</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bookings Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Bookings by Month</h4>
                <div className="space-y-3">
                  {monthlyStats.map((month) => (
                    <div key={month.month} className="flex items-center">
                      <div className="w-12 text-sm text-gray-600">{month.month}</div>
                      <div className="flex-1 mx-3">
                        <div className="bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${(month.bookings / Math.max(...monthlyStats.map(m => m.bookings))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 w-8">{month.bookings}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue by Month</h4>
                <div className="space-y-3">
                  {monthlyStats.map((month) => (
                    <div key={month.month} className="flex items-center">
                      <div className="w-12 text-sm text-gray-600">{month.month}</div>
                      <div className="flex-1 mx-3">
                        <div className="bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-green-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${(month.revenue / Math.max(...monthlyStats.map(m => m.revenue))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 w-16">${(month.revenue/1000).toFixed(1)}k</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Service Breakdown & Popular Locations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Breakdown */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FiUsers className="h-5 w-5 mr-2" />
                Service Breakdown
              </h3>
              <div className="space-y-4">
                {serviceBreakdown.map((service) => (
                  <div key={service.service}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{service.service}</span>
                      <span className="text-gray-900 font-medium">{service.count} ({service.percentage}%)</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${service.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Locations */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FiMap className="h-5 w-5 mr-2" />
                Popular Locations
              </h3>
              <div className="space-y-3">
                {popularLocations.map((location, index) => (
                  <div key={location.location} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {index + 1}
                      </div>
                      <span className="ml-3 text-sm text-gray-900">{location.location}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{location.count} bookings</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Growth Insights */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Growth Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-4 rounded-md">
                <div className="font-medium text-green-600">📅 Peak Season</div>
                <div className="text-gray-700 mt-1">April-June shows highest booking volume</div>
              </div>
              <div className="bg-white p-4 rounded-md">
                <div className="font-medium text-blue-600">🏆 Top Service</div>
                <div className="text-gray-700 mt-1">Real estate photography leads at 35%</div>
              </div>
              <div className="bg-white p-4 rounded-md">
                <div className="font-medium text-purple-600">💰 Revenue Growth</div>
                <div className="text-gray-700 mt-1">+18% increase vs previous quarter</div>
              </div>
            </div>
          </div>
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

AdminAnalytics.displayName = 'AdminPage';
export default AdminAnalytics; 