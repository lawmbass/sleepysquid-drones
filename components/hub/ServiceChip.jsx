import { SERVICE_LINES } from '@/libs/serviceLines';

export default function ServiceChip({ id }) {
  const line = SERVICE_LINES.find((item) => item.id === id);
  if (!line) return null;
  return <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${line.chip}`}>{line.label}</span>;
}

export function ServiceFilter({ value, onChange, label = 'Service' }) {
  const options = [{ id: '', label: 'All services' }, ...SERVICE_LINES];
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={label}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id || 'all'}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              selected
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
