import { useState } from 'react';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';

export default function UserFilters({ filters, onFilterChange }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (field, value) => {
    onFilterChange({ [field]: value });
  };

  const handleClearFilters = () => {
    onFilterChange({
      search: '',
      role: '',
      hasAccess: '',
      page: 1
    });
  };

  const hasActiveFilters = filters.search || filters.role || filters.hasAccess;

  return (
    <div className="bg-white shadow rounded-lg p-4 sm:p-6">
      {/* Mobile-first layout */}
      <div className="space-y-4">
        {/* Search bar - full width on mobile */}
        <div className="w-full">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users by name, email, or company..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              value={filters.search}
              onChange={(e) => handleInputChange('search', e.target.value)}
            />
          </div>
        </div>
        
        {/* Filter buttons - stack on mobile, inline on desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              hasActiveFilters ? 'border-blue-300 bg-blue-50' : ''
            }`}
          >
            <FiFilter className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {[filters.search, filters.role, filters.hasAccess].filter(Boolean).length}
              </span>
            )}
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FiX className="mr-2 h-4 w-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Expanded filters - mobile-friendly grid */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={filters.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="client">Client</option>
                <option value="pilot">Pilot</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access Status
              </label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={filters.hasAccess}
                onChange={(e) => handleInputChange('hasAccess', e.target.value)}
              >
                <option value="">All Users</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={filters.sort}
                onChange={(e) => handleInputChange('sort', e.target.value)}
              >
                <option value="-createdAt">Newest First</option>
                <option value="createdAt">Oldest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="-name">Name (Z-A)</option>
                <option value="email">Email (A-Z)</option>
                <option value="-email">Email (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}