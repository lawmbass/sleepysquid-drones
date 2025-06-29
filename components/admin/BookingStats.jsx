import { FiCalendar, FiDollarSign, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

export default function BookingStats({ stats }) {
  const statCards = [
    {
      name: 'Total Bookings',
      value: Object.values(stats).reduce((sum, stat) => sum + stat.count, 0),
      icon: FiCalendar,
      color: 'bg-blue-500',
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
      value: `$${Object.values(stats).reduce((sum, stat) => sum + (stat.totalValue || 0), 0).toLocaleString()}`,
      icon: FiDollarSign,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
} 