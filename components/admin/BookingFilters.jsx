import { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiFilter, FiX } from 'react-icons/fi';

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

const sources = [
  { value: '', label: 'All Sources' },
  { value: 'customer', label: 'Customer Bookings' },
  { value: 'zeitview', label: 'Zeitview Missions' },
  { value: 'manual', label: 'Manual Entries' }
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
    source: filters.source || '',
    email: filters.email || '',
    date_from: filters.date_from || '',
    date_to: filters.date_to || '',
    payout_min: filters.payout_min || '',
    payout_max: filters.payout_max || '',
    travel_distance_max: filters.travel_distance_max || '',
    sort: filters.sort || '-createdAt'
  });

  // Mobile filter states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    advanced: false,
    dates: false
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
      source: '',
      email: '',
      date_from: '',
      date_to: '',
      payout_min: '',
      payout_max: '',
      travel_distance_max: '',
      sort: '-createdAt'
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getActiveFilterCount = () => {
    return Object.values(localFilters).filter(value => value && value !== '-createdAt').length;
  };

  // Mobile filter component
  const MobileFilters = () => (
    <div className="md:hidden">
      {/* Mobile filter toggle button */}
      <div className="bg-white shadow rounded-lg border border-gray-200 mb-4">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center">
            <FiFilter className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-900">Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {getActiveFilterCount()}
              </span>
            )}
          </div>
          {showMobileFilters ? (
            <FiChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <FiChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {showMobileFilters && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {/* Basic Filters Section */}
            <div>
              <button
                onClick={() => toggleSection('basic')}
                className="w-full flex items-center justify-between py-2"
              >
                <span className="text-sm font-medium text-gray-900">Basic Filters</span>
                {expandedSections.basic ? (
                  <FiChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <FiChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
              
              {expandedSections.basic && (
                <div className="mt-3 space-y-3">
                  {/* Status and Sort in same row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={localFilters.status}
                        onChange={(e) => handleChange('status', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {statuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
                      <select
                        value={localFilters.sort}
                        onChange={(e) => handleChange('sort', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Source and Service */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
                      <select
                        value={localFilters.source}
                        onChange={(e) => handleChange('source', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {sources.map((source) => (
                          <option key={source.value} value={source.value}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Service</label>
                      <select
                        value={localFilters.service}
                        onChange={(e) => handleChange('service', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {services.map((service) => (
                          <option key={service.value} value={service.value}>
                            {service.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Email search */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Customer Email</label>
                    <input
                      type="email"
                      value={localFilters.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="Search by email..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Filters Section */}
            <div>
              <button
                onClick={() => toggleSection('advanced')}
                className="w-full flex items-center justify-between py-2"
              >
                <span className="text-sm font-medium text-gray-900">Advanced Filters</span>
                {expandedSections.advanced ? (
                  <FiChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <FiChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
              
              {expandedSections.advanced && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Min Payout ($)</label>
                      <input
                        type="number"
                        value={localFilters.payout_min}
                        onChange={(e) => handleChange('payout_min', e.target.value)}
                        placeholder="50"
                        min="0"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Max Payout ($)</label>
                      <input
                        type="number"
                        value={localFilters.payout_max}
                        onChange={(e) => handleChange('payout_max', e.target.value)}
                        placeholder="500"
                        min="0"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max Travel Distance (miles)</label>
                    <input
                      type="number"
                      value={localFilters.travel_distance_max}
                      onChange={(e) => handleChange('travel_distance_max', e.target.value)}
                      placeholder="50"
                      min="0"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Date Filters Section */}
            <div>
              <button
                onClick={() => toggleSection('dates')}
                className="w-full flex items-center justify-between py-2"
              >
                <span className="text-sm font-medium text-gray-900">Date Range</span>
                {expandedSections.dates ? (
                  <FiChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <FiChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
              
              {expandedSections.dates && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Event Date From</label>
                    <input
                      type="date"
                      value={localFilters.date_from}
                      onChange={(e) => handleChange('date_from', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Event Date To</label>
                    <input
                      type="date"
                      value={localFilters.date_to}
                      onChange={(e) => handleChange('date_to', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={clearFilters}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Desktop filter component (original)
  const DesktopFilters = () => (
    <div className="hidden md:block">
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

            {/* Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <select
                value={localFilters.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {sources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
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

          {/* Mission-specific filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Payout ($)
              </label>
              <input
                type="number"
                value={localFilters.payout_min}
                onChange={(e) => handleChange('payout_min', e.target.value)}
                placeholder="50"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Payout ($)
              </label>
              <input
                type="number"
                value={localFilters.payout_max}
                onChange={(e) => handleChange('payout_max', e.target.value)}
                placeholder="500"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Travel Distance (miles)
              </label>
              <input
                type="number"
                value={localFilters.travel_distance_max}
                onChange={(e) => handleChange('travel_distance_max', e.target.value)}
                placeholder="50"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
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
    </div>
  );

  return (
    <>
      <MobileFilters />
      <DesktopFilters />
    </>
  );
} 