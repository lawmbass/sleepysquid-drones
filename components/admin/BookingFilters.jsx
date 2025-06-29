import { useState } from 'react';

const services = [
  { value: '', label: 'All Services' },
  { value: 'aerial-photography', label: 'Aerial Photography' },
  { value: 'drone-videography', label: 'Drone Videography' },
  { value: 'mapping-surveying', label: 'Mapping & Surveying' },
  { value: 'real-estate', label: 'Real Estate Tours' },
  { value: 'inspection', label: 'Inspection Services' },
  { value: 'event-coverage', label: 'Event Coverage' },
  { value: 'custom', label: 'Custom Project' }
];

const statuses = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const sortOptions = [
  { value: '-createdAt', label: 'Newest First' },
  { value: 'createdAt', label: 'Oldest First' },
  { value: '-date', label: 'Event Date (Latest)' },
  { value: 'date', label: 'Event Date (Earliest)' },
  { value: 'name', label: 'Customer Name (A-Z)' },
  { value: '-name', label: 'Customer Name (Z-A)' }
];

export default function BookingFilters({ filters, onFilterChange }) {
  const [localFilters, setLocalFilters] = useState({
    status: filters.status || '',
    service: filters.service || '',
    email: filters.email || '',
    date_from: filters.date_from || '',
    date_to: filters.date_to || '',
    sort: filters.sort || '-createdAt'
  });

  const handleChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      status: '',
      service: '',
      email: '',
      date_from: '',
      date_to: '',
      sort: '-createdAt'
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  return (
    <div className="bg-white shadow rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={localFilters.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service
            </label>
            <select
              value={localFilters.service}
              onChange={(e) => handleChange('service', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {services.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
          </div>

          {/* Email Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Email
            </label>
            <input
              type="email"
              value={localFilters.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Search by email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sort Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={localFilters.sort}
              onChange={(e) => handleChange('sort', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Date From
            </label>
            <input
              type="date"
              value={localFilters.date_from}
              onChange={(e) => handleChange('date_from', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Date To
            </label>
            <input
              type="date"
              value={localFilters.date_to}
              onChange={(e) => handleChange('date_to', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <div className="mt-4">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  );
} 