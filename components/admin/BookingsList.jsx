import { useState } from 'react';
import { FiMail, FiPhone, FiMapPin, FiCalendar, FiDollarSign, FiTarget, FiNavigation, FiUser } from 'react-icons/fi';
import BookingModal from './BookingModal';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
};

const serviceLabels = {
  'aerial-photography': 'Aerial Photography',
  'drone-videography': 'Drone Videography',
  'mapping-surveying': 'Mapping & Surveying',
  'real-estate': 'Real Estate Tours',
  'inspection': 'Inspection Services',
  'event-coverage': 'Event Coverage',
  'custom': 'Custom Project'
};

export default function BookingsList({ bookings = [], pagination = {}, loading, onPageChange, onUpdateBooking, onDeleteBooking }) {
  // Provide default pagination values
  const paginationDefaults = {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasPrevPage: false,
    hasNextPage: false,
    ...pagination
  };
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedBooking(null);
    setIsModalOpen(false);
  };

  const handleUpdateBooking = async (bookingId, updates) => {
    const success = await onUpdateBooking(bookingId, updates);
    if (success) {
      handleCloseModal();
    }
    return success;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mobile booking card component
  const MobileBookingCard = ({ booking }) => (
    <div 
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => handleViewBooking(booking)}
    >
      {/* Header with name and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center">
            <FiUser className="h-4 w-4 text-gray-500 mr-2" />
            <span className="font-medium text-gray-900 dark:text-white">{booking.name}</span>
            {booking.source !== 'customer' && (
              <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${
                booking.source === 'zeitview' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {booking.source === 'zeitview' ? 'ZV' : booking.source?.toUpperCase() || ''}
              </span>
            )}
          </div>
          {booking.missionId && (
            <div className="flex items-center mt-1">
              <FiTarget className="h-3 w-3 text-gray-400 mr-1" />
              <span className="text-xs text-gray-500">{booking.missionId}</span>
            </div>
          )}
        </div>
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-800'}`}>
          {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Unknown'}
        </span>
      </div>

      {/* Service and Date Info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Service</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {serviceLabels[booking.service] || booking.service}
          </div>
          {booking.package && (
            <div className="text-xs text-gray-500 capitalize">{booking.package} pkg</div>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Event Date</div>
          <div className="text-sm font-medium text-gray-900 flex items-center">
            <FiCalendar className="h-3 w-3 mr-1" />
            {formatDate(booking.date)}
          </div>
        </div>
      </div>

      {/* Location and Contact */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start">
          <FiMapPin className="h-3 w-3 text-gray-400 mr-1 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
            {booking.location.length > 50 ? `${booking.location.substring(0, 50)}...` : booking.location}
          </span>
        </div>
        <div className="flex items-center">
          <FiMail className="h-3 w-3 text-gray-400 mr-1" />
          <span className="text-xs text-gray-600 dark:text-gray-300">{booking.email}</span>
        </div>
        {booking.source === 'customer' && booking.phone && (
          <div className="flex items-center">
            <FiPhone className="h-3 w-3 text-gray-400 mr-1" />
            <span className="text-xs text-gray-600 dark:text-gray-300">{booking.phone}</span>
          </div>
        )}
      </div>

      {/* Price and Travel Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center">
          <FiDollarSign className="h-3 w-3 text-gray-400 mr-1" />
          <span className="font-medium text-gray-900 dark:text-white">
            {booking.payout 
              ? `$${booking.payout.toLocaleString()}` 
              : booking.finalPrice 
                ? `$${booking.finalPrice.toLocaleString()}` 
                : booking.estimatedPrice 
                  ? `~$${booking.estimatedPrice.toLocaleString()}` 
                  : 'TBD'
            }
          </span>
          {booking.payout && <span className="text-gray-500 ml-1">(payout)</span>}
        </div>
        {booking.travelDistance && (
          <div className="flex items-center text-gray-500">
            <FiNavigation className="h-3 w-3 mr-1" />
            <span>{booking.travelDistance.toFixed(1)}mi</span>
            {booking.travelTime && <span className="ml-1">({Math.round(booking.travelTime)}min)</span>}
          </div>
        )}
      </div>

      {/* Created date */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Created: {formatDate(booking.createdAt)}</span>
          <span>{formatTime(booking.createdAt)}</span>
        </div>
      </div>
    </div>
  );

  // Mobile view component
  const MobileBookingsList = () => (
    <div className="md:hidden">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Bookings ({paginationDefaults.totalCount})
          </h3>
        </div>
        
        {bookings.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p>No bookings found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="p-4 space-y-4">
              {bookings.map((booking) => (
                <MobileBookingCard key={booking._id} booking={booking} />
              ))}
            </div>

            {/* Mobile Pagination */}
            {paginationDefaults.totalPages > 1 && (
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Page {paginationDefaults.currentPage} of {paginationDefaults.totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onPageChange(paginationDefaults.currentPage - 1)}
                      disabled={!paginationDefaults.hasPrevPage}
                      className={`px-3 py-1 text-sm rounded-md ${
                        paginationDefaults.hasPrevPage
                          ? 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      }`}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => onPageChange(paginationDefaults.currentPage + 1)}
                      disabled={!paginationDefaults.hasNextPage}
                      className={`px-3 py-1 text-sm rounded-md ${
                        paginationDefaults.hasNextPage
                          ? 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Desktop view component (original table)
  const DesktopBookingsList = () => (
          <div className="hidden md:block">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Bookings ({paginationDefaults.totalCount})
          </h3>
        </div>
        
        {bookings.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p>No bookings found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer/Mission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Event Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Price/Payout
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Travel Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {bookings.map((booking) => (
                    <tr 
                      key={booking._id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => handleViewBooking(booking)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                              {booking.name}
                              {booking.source !== 'customer' && (
                                <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                                  booking.source === 'zeitview' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {booking.source === 'zeitview' ? 'ZV' :
                                   booking.source?.toUpperCase() || ''}
                                </span>
                              )}
                            </div>
                            {booking.missionId && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                                <FiTarget className="h-3 w-3 mr-1" />
                                {booking.missionId}
                              </div>
                            )}
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                              <FiMail className="h-3 w-3 mr-1" />
                              {booking.email}
                            </div>
                            {booking.source === 'customer' && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                                <FiPhone className="h-3 w-3 mr-1" />
                                {booking.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {serviceLabels[booking.service] || booking.service}
                        </div>
                        {booking.package && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {booking.package} package
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white flex items-center">
                          <FiCalendar className="h-3 w-3 mr-1" />
                          {formatDate(booking.date)}
                        </div>

                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          <FiMapPin className="h-3 w-3 mr-1" />
                          {booking.location.length > 30 
                            ? `${booking.location.substring(0, 30)}...` 
                            : booking.location
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-800'}`}>
                          {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white flex items-center">
                          <FiDollarSign className="h-3 w-3 mr-1" />
                          {booking.payout 
                            ? booking.payout.toLocaleString() 
                            : booking.finalPrice 
                              ? booking.finalPrice.toLocaleString() 
                              : booking.estimatedPrice 
                                ? `~${booking.estimatedPrice.toLocaleString()}` 
                                : 'TBD'
                          }
                        </div>
                        {booking.payout && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Mission Payout
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.travelDistance && (
                          <div className="text-sm text-gray-900 dark:text-white flex items-center">
                            <FiNavigation className="h-3 w-3 mr-1" />
                            {booking.travelDistance.toFixed(1)} mi
                          </div>
                        )}
                        {booking.travelTime && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.round(booking.travelTime)} min
                          </div>
                        )}
                        {booking.acceptedAt && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Auto-accepted
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div>{formatDate(booking.createdAt)}</div>
                        <div>{formatTime(booking.createdAt)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination */}
            {paginationDefaults.totalPages > 1 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                                        <button
                      onClick={() => onPageChange(paginationDefaults.currentPage - 1)}
                      disabled={!paginationDefaults.hasPrevPage}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md ${
                        paginationDefaults.hasPrevPage
                          ? 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                          : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => onPageChange(paginationDefaults.currentPage + 1)}
                      disabled={!paginationDefaults.hasNextPage}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md ${
                        paginationDefaults.hasNextPage
                          ? 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                          : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing page <span className="font-medium">{paginationDefaults.currentPage}</span> of{' '}
                      <span className="font-medium">{paginationDefaults.totalPages}</span> ({paginationDefaults.totalCount} total bookings)
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => onPageChange(paginationDefaults.currentPage - 1)}
                        disabled={!paginationDefaults.hasPrevPage}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 text-sm font-medium ${
                          paginationDefaults.hasPrevPage
                            ? 'text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            : 'text-gray-300 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                        }`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => onPageChange(paginationDefaults.currentPage + 1)}
                        disabled={!paginationDefaults.hasNextPage}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 text-sm font-medium ${
                          paginationDefaults.hasNextPage
                            ? 'text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            : 'text-gray-300 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                        }`}
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Bookings</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileBookingsList />
      <DesktopBookingsList />

      {/* Booking Modal */}
      {isModalOpen && selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdate={handleUpdateBooking}
          onDelete={onDeleteBooking}
        />
      )}
    </>
  );
} 