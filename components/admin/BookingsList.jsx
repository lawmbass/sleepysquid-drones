import { useState } from 'react';
import { FiEye, FiMail, FiPhone, FiMapPin, FiCalendar, FiClock, FiDollarSign } from 'react-icons/fi';
import BookingModal from './BookingModal';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800'
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

export default function BookingsList({ bookings, pagination, loading, onPageChange, onUpdateBooking }) {
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

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Bookings</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Bookings ({pagination.totalCount || 0})
          </h3>
        </div>
        
        {bookings.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No bookings found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {booking.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <FiMail className="h-3 w-3 mr-1" />
                              {booking.email}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <FiPhone className="h-3 w-3 mr-1" />
                              {booking.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {serviceLabels[booking.service] || booking.service}
                        </div>
                        {booking.package && (
                          <div className="text-sm text-gray-500 capitalize">
                            {booking.package} package
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <FiCalendar className="h-3 w-3 mr-1" />
                          {formatDate(booking.date)}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <FiClock className="h-3 w-3 mr-1" />
                          {booking.duration}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <FiMapPin className="h-3 w-3 mr-1" />
                          {booking.location.length > 30 
                            ? `${booking.location.substring(0, 30)}...` 
                            : booking.location
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-800'}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <FiDollarSign className="h-3 w-3 mr-1" />
                          {booking.finalPrice 
                            ? `$${booking.finalPrice.toLocaleString()}` 
                            : booking.estimatedPrice 
                              ? `~$${booking.estimatedPrice.toLocaleString()}` 
                              : 'TBD'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatDate(booking.createdAt)}</div>
                        <div>{formatTime(booking.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewBooking(booking)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="View/Edit Booking"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => onPageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                      pagination.hasPrevPage
                        ? 'text-gray-700 bg-white hover:bg-gray-50'
                        : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => onPageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                      pagination.hasNextPage
                        ? 'text-gray-700 bg-white hover:bg-gray-50'
                        : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page <span className="font-medium">{pagination.currentPage}</span> of{' '}
                      <span className="font-medium">{pagination.totalPages}</span> ({pagination.totalCount} total bookings)
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => onPageChange(pagination.currentPage - 1)}
                        disabled={!pagination.hasPrevPage}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                          pagination.hasPrevPage
                            ? 'text-gray-500 bg-white hover:bg-gray-50'
                            : 'text-gray-300 bg-gray-100 cursor-not-allowed'
                        }`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => onPageChange(pagination.currentPage + 1)}
                        disabled={!pagination.hasNextPage}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                          pagination.hasNextPage
                            ? 'text-gray-500 bg-white hover:bg-gray-50'
                            : 'text-gray-300 bg-gray-100 cursor-not-allowed'
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

      {/* Booking Modal */}
      {isModalOpen && selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdate={handleUpdateBooking}
        />
      )}
    </>
  );
} 