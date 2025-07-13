import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  FiTrendingUp, 
  FiDollarSign, 
  FiCalendar, 
  FiUsers, 
  FiMap, 
  FiActivity, 
  FiBarChart, 
  FiTarget,
  FiClock,
  FiRefreshCw
} from 'react-icons/fi';
import { adminConfig } from '@/libs/adminConfig';

function AdminAnalytics() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState({
    totalStats: {
      totalBookings: 0,
      totalRevenue: 0,
      avgPayout: 0
    },
    recentActivity: [],
    serviceBreakdown: [],
    statusBreakdown: [],
    sourceBreakdown: [],
    locationStats: [],
    monthlyStats: [],
    loading: true,
    error: null
  });

  // Check if user is admin
  const isAdmin = session?.user?.isAdmin || adminConfig.isAdmin(session?.user?.email);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    } else if (session && isAdmin) {
      fetchAnalytics();
    }
  }, [session, isAdmin, status, router]);

  const fetchAnalytics = async () => {
    try {
      setAnalytics(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch('/api/admin/analytics', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setAnalytics({
        ...data,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message 
      }));
    }
  };

  // Authentication loading state
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

  // Not authenticated
  if (!session) {
    return null;
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-red-500 mb-4">
            <FiUsers className="mx-auto h-12 w-12" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
          <button
            onClick={() => signOut()}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const { 
    totalStats, 
    recentActivity, 
    serviceBreakdown, 
    statusBreakdown, 
    sourceBreakdown, 
    locationStats, 
    monthlyStats, 
    loading, 
    error 
  } = analytics;

  return (
    <>
      <Head>
        <title>Analytics - Admin Dashboard</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <AdminLayout user={session.user} onSignOut={() => signOut()}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading analytics</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Main Content */}
          {!loading && !error && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-500 rounded-lg">
                      <FiCalendar className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                      <p className="text-2xl font-bold text-gray-900">{totalStats.totalBookings}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-500 rounded-lg">
                      <FiDollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">${totalStats.totalRevenue?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-500 rounded-lg">
                      <FiTrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Avg. Payout</p>
                      <p className="text-2xl font-bold text-gray-900">${totalStats.avgPayout || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Performance */}
              {monthlyStats.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Performance (Last 6 Months)</h2>
                  <div className="space-y-4">
                    {monthlyStats.map((month, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FiBarChart className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{month.month} {month.year}</p>
                            <p className="text-sm text-gray-500">{month.bookings} bookings</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">${month.revenue?.toLocaleString() || 0}</p>
                          <p className="text-sm text-gray-500">Revenue</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service & Status Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Service Breakdown */}
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Breakdown</h2>
                  <div className="space-y-3">
                    {serviceBreakdown.map((service, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-900">{service.service}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{service.count} bookings</span>
                          <span className="text-sm font-medium text-gray-900">{service.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Status</h2>
                  <div className="space-y-3">
                    {statusBreakdown.map((status, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            status.status === 'Completed' ? 'bg-green-500' :
                            status.status === 'Pending' ? 'bg-yellow-500' :
                            status.status === 'Accepted' ? 'bg-blue-500' :
                            'bg-red-500'
                          }`}></div>
                          <span className="text-sm font-medium text-gray-900">{status.status}</span>
                        </div>
                        <span className="text-sm text-gray-500">{status.count} bookings</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Source & Location Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Source Breakdown */}
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Sources</h2>
                  <div className="space-y-3">
                    {sourceBreakdown.map((source, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <FiTarget className="h-4 w-4 text-gray-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{source.source}</span>
                        </div>
                        <span className="text-sm text-gray-500">{source.count} bookings</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Locations */}
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Locations</h2>
                  <div className="space-y-3">
                    {locationStats.slice(0, 5).map((location, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <FiMap className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{location.location}</span>
                        </div>
                        <span className="text-sm text-gray-500">{location.count} bookings</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentActivity.map((activity, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {activity.service?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {activity.location || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {activity.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                              activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              activity.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {activity.status || 'unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </>
  );
}

export default AdminAnalytics;

export async function getServerSideProps() {
  return {
    props: {},
  };
} 