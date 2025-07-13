import { useState, useEffect } from 'react';
import { FiTrendingUp, FiDollarSign, FiCalendar, FiUsers, FiMap } from 'react-icons/fi';

export default function AdminAnalytics({ user }) {
  const [analytics, setAnalytics] = useState({
    monthlyStats: [],
    serviceBreakdown: [],
    revenueOverTime: [],
    popularLocations: [],
    loading: true
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/missions/analytics', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalytics({
        monthlyStats: data.monthlyStats || [],
        serviceBreakdown: data.serviceBreakdown || [],
        revenueOverTime: data.revenueOverTime || [],
        popularLocations: data.popularLocations || [],
        loading: false
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(prev => ({ ...prev, loading: false }));
    }
  };

  if (analytics.loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiTrendingUp className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Missions</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analytics.monthlyStats.reduce((sum, stat) => sum + stat.missions, 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiDollarSign className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${analytics.revenueOverTime.reduce((sum, rev) => sum + rev.amount, 0).toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiCalendar className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">This Month</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analytics.monthlyStats[analytics.monthlyStats.length - 1]?.missions || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiUsers className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Clients</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analytics.monthlyStats[analytics.monthlyStats.length - 1]?.clients || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Breakdown */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Service Breakdown</h3>
        </div>
        <div className="p-6">
          {analytics.serviceBreakdown.length > 0 ? (
            <div className="space-y-4">
              {analytics.serviceBreakdown.map((service, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900">{service.name}</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-500">{service.count} missions</div>
                    <div className="text-sm font-medium text-gray-900">
                      ${service.revenue.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No service data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Popular Locations */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Popular Locations</h3>
        </div>
        <div className="p-6">
          {analytics.popularLocations.length > 0 ? (
            <div className="space-y-4">
              {analytics.popularLocations.map((location, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiMap className="h-4 w-4 text-gray-400 mr-2" />
                    <div className="text-sm font-medium text-gray-900">{location.name}</div>
                  </div>
                  <div className="text-sm text-gray-500">{location.count} missions</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No location data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}