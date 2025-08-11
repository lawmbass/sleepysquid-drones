import { useState, useEffect, useCallback } from 'react';
import { FiTrendingUp, FiDollarSign, FiMapPin, FiBarChart, FiActivity, FiRefreshCw } from 'react-icons/fi';

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (selectedPeriod = period) => {
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
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    // Remove direct fetchAnalytics call - useEffect will handle it when period changes
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

  const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle, change }) => {
    // Define color classes explicitly to avoid Tailwind purging
    const colorClasses = {
      blue: {
        bg: 'bg-blue-100',
        text: 'text-blue-600'
      },
      green: {
        bg: 'bg-green-100',
        text: 'text-green-600'
      },
      purple: {
        bg: 'bg-purple-100',
        text: 'text-purple-600'
      },
      orange: {
        bg: 'bg-orange-100',
        text: 'text-orange-600'
      },
      red: {
        bg: 'bg-red-100',
        text: 'text-red-600'
      },
      yellow: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-600'
      }
    };

    const selectedColor = colorClasses[color] || colorClasses.blue;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-md ${selectedColor.bg} dark:bg-opacity-20`}>
            <Icon className={`h-6 w-6 ${selectedColor.text}`} />
          </div>
        </div>
        {change && (
          <div className="mt-4 flex items-center">
            <span className={`text-sm ${change.type === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {change.type === 'increase' ? '+' : '-'}{change.value}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
          </div>
        )}
      </div>
    );
  };

  // Mobile compact analytics overview
  const MobileAnalyticsOverview = ({ summary, performanceMetrics }) => (
    <div className="md:hidden space-y-4">
      {/* Header with controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Analytics</h1>
          <div className="flex items-center space-x-2">
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
              <option value="365d">1y</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
            >
              <FiRefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Key metrics in compact 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <FiActivity className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatNumber(summary.totalMissions)}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">Total Missions</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <FiDollarSign className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
            <div className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.totalRevenue)}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">Total Revenue</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <FiTrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{summary.completionRate || 0}%</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">Completion Rate</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <FiMapPin className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
            <div className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatCurrency(summary.revenuePerMile)}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">Revenue/Mile</div>
          </div>
        </div>
      </div>

      {/* Mission Status Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Mission Status</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Completed</span>
            </div>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {formatNumber(performanceMetrics.completedMissions || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">In Progress</span>
            </div>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {formatNumber(performanceMetrics.inProgressMissions || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Cancelled</span>
            </div>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {formatNumber(performanceMetrics.cancelledMissions || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Revenue Insights */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Revenue Insights</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(performanceMetrics.maxPayout || 0)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Highest</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(performanceMetrics.minPayout || 0)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Lowest</p>
          </div>
          <div>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency((performanceMetrics.totalRevenue || 0) / (performanceMetrics.totalMissions || 1))}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Average</p>
          </div>
        </div>
      </div>

      {/* Travel Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Travel Statistics</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Total Distance</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatNumber(performanceMetrics.totalTravelDistance || 0)} mi
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Total Time</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatNumber(performanceMetrics.totalTravelTime || 0)} min
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Max Distance</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatNumber(performanceMetrics.maxTravelDistance || 0)} mi
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile compact source breakdown
  const MobileSourceBreakdown = ({ data }) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="md:hidden bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Mission Sources</h3>
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No source data available</p>
          </div>
        </div>
      );
    }

    const sources = Object.entries(data);
    const maxCount = Math.max(...sources.map(([, source]) => source.count));

    return (
      <div className="md:hidden bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Mission Sources</h3>
        <div className="space-y-3">
          {sources.map(([sourceName, source]) => (
            <div key={sourceName} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{sourceName}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{source.count}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(source.count / maxCount) * 100}%` }}
                  ></div>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(source.totalPayout)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Mobile compact location insights
  const MobileLocationInsights = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="md:hidden bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Distance Distribution</h3>
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No location data available</p>
          </div>
        </div>
      );
    }

    const getBoundaryLabel = (boundary) => {
      if (boundary === '100+') return '100+ mi';
      if (boundary === 0) return '0-10 mi';
      if (boundary === 10) return '10-25 mi';
      if (boundary === 25) return '25-50 mi';
      if (boundary === 50) return '50-100 mi';
      return `${boundary} mi`;
    };

    return (
      <div className="md:hidden bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Distance Distribution</h3>
        <div className="space-y-3">
          {data.map((location, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-2">
                <FiMapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {getBoundaryLabel(location._id)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{location.count} missions</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(location.totalPayout)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SourceBreakdownChart = ({ data }) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No source data available</p>
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
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{sourceName}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{source.count} missions</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(source.count / maxCount) * 100}%` }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
          <p className="text-gray-500 dark:text-gray-400">No location data available</p>
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
          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <FiMapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {getBoundaryLabel(location._id)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{location.count} missions</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatCurrency(location.totalPayout)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Avg: {formatCurrency(location.avgPayout)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Desktop view component
  const DesktopAnalytics = ({ summary, sourceBreakdown, locationInsights, performanceMetrics }) => (
    <div className="hidden md:block space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Track performance metrics and business insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Mission Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Completed</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {formatNumber(performanceMetrics.completedMissions || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">In Progress</span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {formatNumber(performanceMetrics.inProgressMissions || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Cancelled</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {formatNumber(performanceMetrics.cancelledMissions || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Travel Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Distance</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatNumber(performanceMetrics.totalTravelDistance || 0)} miles
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Time</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatNumber(performanceMetrics.totalTravelTime || 0)} minutes
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Max Distance</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatNumber(performanceMetrics.maxTravelDistance || 0)} miles
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Source Breakdown & Location Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Mission Sources</h3>
            <FiBarChart className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <SourceBreakdownChart data={sourceBreakdown} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Distance Distribution</h3>
            <FiMapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <LocationInsights data={locationInsights} />
        </div>
      </div>

      {/* Revenue Insights */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Revenue Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(performanceMetrics.maxPayout || 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Highest Payout</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(performanceMetrics.minPayout || 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Lowest Payout</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency((performanceMetrics.totalRevenue || 0) / (performanceMetrics.totalMissions || 1))}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Average Payout</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error loading analytics</h3>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 bg-red-100 dark:bg-red-800/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-800 dark:text-red-300 px-3 py-1 rounded text-sm"
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
        <p className="text-gray-500 dark:text-gray-400">No analytics data available</p>
      </div>
    );
  }

  const { summary, sourceBreakdown, locationInsights, performanceMetrics } = analytics;

  return (
    <div className="space-y-6">
      {/* Mobile View */}
      <MobileAnalyticsOverview summary={summary} performanceMetrics={performanceMetrics} />
      <MobileSourceBreakdown data={sourceBreakdown} />
      <MobileLocationInsights data={locationInsights} />
      
      {/* Desktop View */}
      <DesktopAnalytics 
        summary={summary} 
        sourceBreakdown={sourceBreakdown} 
        locationInsights={locationInsights} 
        performanceMetrics={performanceMetrics} 
      />
    </div>
  );
}