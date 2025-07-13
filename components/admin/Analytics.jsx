import { useState, useEffect } from 'react';
import { FiTrendingUp, FiDollarSign, FiMapPin, FiClock, FiBarChart, FiActivity, FiRefreshCw } from 'react-icons/fi';

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async (selectedPeriod = period) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/admin/missions/analytics?period=${selectedPeriod}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setAnalytics(result.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    fetchAnalytics(newPeriod);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle, change }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-md bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center">
          <span className={`text-sm ${change.type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
            {change.type === 'increase' ? '+' : '-'}{change.value}
          </span>
          <span className="text-sm text-gray-500 ml-1">vs last period</span>
        </div>
      )}
    </div>
  );

  const SourceBreakdownChart = ({ data }) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No source data available</p>
        </div>
      );
    }

    const sources = Object.entries(data);
    const maxCount = Math.max(...sources.map(([, source]) => source.count));

    return (
      <div className="space-y-4">
        {sources.map(([sourceName, source]) => (
          <div key={sourceName} className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 capitalize">{sourceName}</span>
                <span className="text-sm text-gray-500">{source.count} missions</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(source.count / maxCount) * 100}%` }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Avg: {formatCurrency(source.avgPayout)} | Total: {formatCurrency(source.totalPayout)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const LocationInsights = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No location data available</p>
        </div>
      );
    }

    const getBoundaryLabel = (boundary) => {
      if (boundary === '100+') return '100+ miles';
      if (boundary === 0) return '0-10 miles';
      if (boundary === 10) return '10-25 miles';
      if (boundary === 25) return '25-50 miles';
      if (boundary === 50) return '50-100 miles';
      return `${boundary} miles`;
    };

    return (
      <div className="space-y-4">
        {data.map((location, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <FiMapPin className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {getBoundaryLabel(location._id)}
                </p>
                <p className="text-xs text-gray-500">{location.count} missions</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {formatCurrency(location.totalPayout)}
              </p>
              <p className="text-xs text-gray-500">
                Avg: {formatCurrency(location.avgPayout)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading analytics</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  const { summary, sourceBreakdown, locationInsights, performanceMetrics } = analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Track performance metrics and business insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last year</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center space-x-2 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Missions"
          value={formatNumber(summary.totalMissions)}
          icon={FiActivity}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={FiDollarSign}
          color="green"
        />
        <StatCard
          title="Completion Rate"
          value={`${summary.completionRate || 0}%`}
          icon={FiTrendingUp}
          color="purple"
        />
        <StatCard
          title="Revenue per Mile"
          value={formatCurrency(summary.revenuePerMile)}
          icon={FiMapPin}
          color="orange"
        />
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Mission Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed</span>
              <span className="text-sm font-medium text-green-600">
                {formatNumber(performanceMetrics.completedMissions || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">In Progress</span>
              <span className="text-sm font-medium text-blue-600">
                {formatNumber(performanceMetrics.inProgressMissions || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Cancelled</span>
              <span className="text-sm font-medium text-red-600">
                {formatNumber(performanceMetrics.cancelledMissions || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Travel Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Distance</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(performanceMetrics.totalTravelDistance || 0)} miles
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Time</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(performanceMetrics.totalTravelTime || 0)} minutes
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Max Distance</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(performanceMetrics.maxTravelDistance || 0)} miles
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Source Breakdown & Location Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Mission Sources</h3>
            <FiBarChart className="h-5 w-5 text-gray-400" />
          </div>
          <SourceBreakdownChart data={sourceBreakdown} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Distance Distribution</h3>
            <FiMapPin className="h-5 w-5 text-gray-400" />
          </div>
          <LocationInsights data={locationInsights} />
        </div>
      </div>

      {/* Revenue Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(performanceMetrics.maxPayout || 0)}
            </p>
            <p className="text-sm text-gray-600">Highest Payout</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(performanceMetrics.minPayout || 0)}
            </p>
            <p className="text-sm text-gray-600">Lowest Payout</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency((performanceMetrics.totalRevenue || 0) / (performanceMetrics.totalMissions || 1))}
            </p>
            <p className="text-sm text-gray-600">Average Payout</p>
          </div>
        </div>
      </div>
    </div>
  );
}