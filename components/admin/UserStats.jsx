export default function UserStats({ stats }) {
  if (!stats || Object.keys(stats).length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg px-2 py-2">
        <div className="animate-pulse grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const tiles = [
    { label: 'Total', value: stats.users || 0 },
    { label: 'Active', value: stats.withAccess || 0 },
    { label: 'Pending', value: stats.pendingInvitations || 0 },
    { label: 'Inactive', value: stats.withoutAccess || 0 },
  ];
  const roles = `Admins ${stats.roles?.admin || 0} · Clients ${stats.roles?.client || 0} · Pilots ${stats.roles?.pilot || 0}`;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg px-2 py-2">
      <div className="grid grid-cols-4 gap-1 text-center">
        {tiles.map((tile) => (
          <div key={tile.label} className="min-w-0 px-0.5">
            <p className="text-base font-semibold leading-none text-gray-900 dark:text-white">{tile.value}</p>
            <p className="mt-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">{tile.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-center text-xs leading-none text-gray-600 dark:text-gray-300">{roles}</p>
    </div>
  );
}
