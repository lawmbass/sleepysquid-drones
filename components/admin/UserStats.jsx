import { FiUsers, FiUserCheck, FiUserX, FiShield, FiUser, FiTruck, FiSettings } from 'react-icons/fi';

export default function UserStats({ stats }) {
  if (!stats || Object.keys(stats).length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.total || 0,
      icon: FiUsers,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Active Users',
      value: stats.withAccess || 0,
      icon: FiUserCheck,
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Inactive Users',
      value: stats.withoutAccess || 0,
      icon: FiUserX,
      color: 'red',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600'
    },
    {
      title: 'Admins',
      value: stats.roles?.admin || 0,
      icon: FiShield,
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600'
    }
  ];

  const roleCards = [
    {
      title: 'Clients',
      value: stats.roles?.client || 0,
      icon: FiUser,
      color: 'indigo',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600'
    },
    {
      title: 'Pilots',
      value: stats.roles?.pilot || 0,
      icon: FiTruck,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    },
    {
      title: 'Regular Users',
      value: stats.roles?.user || 0,
      icon: FiSettings,
      color: 'gray',
      bgColor: 'bg-gray-50',
      iconColor: 'text-gray-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div key={stat.title} className="relative">
              <div className={`${stat.bgColor} rounded-lg p-4`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Distribution */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Role Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleCards.map((stat) => (
            <div key={stat.title} className="relative">
              <div className={`${stat.bgColor} rounded-lg p-4`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}