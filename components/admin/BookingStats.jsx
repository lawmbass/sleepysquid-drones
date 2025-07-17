import { FiCalendar, FiDollarSign, FiClock, FiCheckCircle, FiAlertCircle, FiTarget, FiNavigation } from 'react-icons/fi';

export default function BookingStats({ stats, missionStats, user }) {
  const totalBookings = Object.values(stats).reduce((sum, stat) => {
    return sum + (typeof stat === 'object' && stat.count ? stat.count : 0);
  }, 0);
  const totalRevenue = Object.values(stats).reduce((sum, stat) => {
    return sum + (typeof stat === 'object' && stat.totalValue ? stat.totalValue : 0);
  }, 0);
  
  const statCards = [
    {
      name: 'Total Bookings',
      value: totalBookings,
      icon: FiCalendar,
      color: 'bg-blue-500',
    },
    {
      name: 'Customer Bookings',
      value: stats.customerBookings || 0,
      icon: FiCalendar,
      color: 'bg-indigo-500',
    },
    {
      name: 'Mission Bookings',
      value: missionStats?.totalMissions || 0,
      icon: FiTarget,
      color: 'bg-cyan-500',
    },
    {
      name: 'Pending',
      value: stats.pending?.count || 0,
      icon: FiClock,
      color: 'bg-yellow-500',
    },
    {
      name: 'Confirmed',
      value: stats.confirmed?.count || 0,
      icon: FiCheckCircle,
      color: 'bg-green-500',
    },
    {
      name: 'In Progress',
      value: stats['in-progress']?.count || 0,
      icon: FiAlertCircle,
      color: 'bg-orange-500',
    },
    {
      name: 'Completed',
      value: stats.completed?.count || 0,
      icon: FiCheckCircle,
      color: 'bg-emerald-500',
    },
    {
      name: 'Total Revenue',
      value: totalRevenue.toLocaleString(),
      icon: FiDollarSign,
      color: 'bg-purple-500',
    },
  ];

  // Add mission-specific stats if available
  if (missionStats?.totalPayout) {
    statCards.push({
      name: 'Mission Payouts',
      value: missionStats.totalPayout.toLocaleString(),
      icon: FiDollarSign,
      color: 'bg-pink-500',
    });
  }

  if (missionStats?.avgTravelDistance) {
    statCards.push({
      name: 'Avg Travel Distance',
      value: `${missionStats.avgTravelDistance.toFixed(1)} mi`,
      icon: FiNavigation,
      color: 'bg-teal-500',
    });
  }

  // Mobile compact view component
  const MobileCompactView = () => (
    <div className="md:hidden">
      {/* Main summary card */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Dashboard Overview</h3>
          <div className="text-sm text-gray-500">Welcome back, {user?.name || 'Lawrence'}</div>
        </div>
        
        {/* Key metrics in compact grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <FiCalendar className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-blue-600">{totalBookings}</div>
            <div className="text-xs text-gray-600">Total Bookings</div>
          </div>
          
          <div className="text-center p-3 bg-indigo-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <FiCalendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="text-xl font-bold text-indigo-600">{stats.customerBookings || 0}</div>
            <div className="text-xs text-gray-600">Customer Bookings</div>
          </div>
          
          <div className="text-center p-3 bg-cyan-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <FiTarget className="h-5 w-5 text-cyan-600" />
            </div>
            <div className="text-xl font-bold text-cyan-600">{missionStats?.totalMissions || 0}</div>
            <div className="text-xs text-gray-600">Mission Bookings</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <FiDollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-lg font-bold text-purple-600">${totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-gray-600">Total Revenue</div>
          </div>
        </div>
        
        {/* Status breakdown */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                <span className="text-gray-600">Pending</span>
                <span className="ml-1 font-medium">{stats.pending?.count || 0}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                <span className="text-gray-600">Confirmed</span>
                <span className="ml-1 font-medium">{stats.confirmed?.count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop view component
  const DesktopView = () => (
    <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow rounded-lg border border-gray-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} rounded-md p-3`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <MobileCompactView />
      <DesktopView />
    </>
  );
} 