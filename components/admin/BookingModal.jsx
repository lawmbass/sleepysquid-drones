import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiSave, FiMail, FiPhone, FiMapPin, FiCalendar, FiClock, FiPackage, FiTarget, FiNavigation, FiDollarSign, FiTrash2 } from 'react-icons/fi';
import ConfirmationDialog from './ConfirmationDialog';
import { CancelGigButton, CancelStatusBadge } from './CancelGigModal';
import { gigCardState, missionDetailAmounts } from '@/libs/jobs';
import { bookingSourceLabel, isQuotePackage, packageLabel } from '@/libs/manualBooking';

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const serviceLabels = {
  'aerial-photography': 'Aerial Photography',
  'drone-videography': 'Drone Videography',
  'mapping-surveying': 'Mapping & Surveying',
  'real-estate': 'Real Estate Tours',
  'inspection': 'Inspection Services',
  'event-coverage': 'Event Coverage',
  'custom': 'Custom Project'
};

export default function BookingModal({ booking, isOpen, onClose, onUpdate, onDelete, onGigUpdated }) {
  const [formData, setFormData] = useState({
    status: booking.status,
    estimatedPrice: booking.estimatedPrice ?? '',
    finalPrice: booking.finalPrice ?? '',
    adminNotes: booking.adminNotes || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (booking) {
      setFormData({
        status: booking.status,
        estimatedPrice: booking.estimatedPrice ?? '',
        finalPrice: booking.finalPrice ?? '',
        adminNotes: booking.adminNotes || ''
      });
    }
  }, [booking]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (booking.unlinkedListing) return;
    setIsSubmitting(true);
    setError('');

    try {
      const updates = {};
      
      // Only include changed fields
      if (formData.status !== booking.status) {
        updates.status = formData.status;
      }
      if (formData.estimatedPrice !== (booking.estimatedPrice ?? '')) {
        updates.estimatedPrice = formData.estimatedPrice === "" ? null : parseFloat(formData.estimatedPrice);
      }
      if (formData.finalPrice !== (booking.finalPrice ?? '')) {
        updates.finalPrice = formData.finalPrice === "" ? null : parseFloat(formData.finalPrice);
      }
      if (formData.adminNotes !== (booking.adminNotes || '')) {
        updates.adminNotes = formData.adminNotes;
      }

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      const success = await onUpdate(booking._id, updates);
      if (success) {
        onClose();
      } else {
        setError('Failed to update booking. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      const success = await onDelete(booking._id);
      if (success) {
        onClose();
      } else {
        setError('Failed to delete booking. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while deleting. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString, options = {}) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    });
  };

  const formatTime = (dateString, options = {}) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    });
  };

  const clockOptions = booking?.wallClock ? { timeZone: "UTC" } : {};

  if (!isOpen) return null;

  const gigActions = gigCardState({
    job: booking,
    booking: booking.unlinkedListing ? null : booking,
  });
  const readOnlyJob = Boolean(booking.unlinkedListing || booking.readOnly);
  const amounts = missionDetailAmounts(booking);
  const payoutValue = amounts.payoutIsFixed ? amounts.payout : formData.estimatedPrice;
  const finalValue = readOnlyJob || formData.finalPrice === ""
    ? (amounts.finalPrice ?? "")
    : formData.finalPrice;
  const fieldClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-900 dark:disabled:bg-gray-900 dark:disabled:text-gray-100";
  const customerLike = booking.source === 'customer' || booking.source === 'manual';

  const modalContent = (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-[60] flex items-start justify-center p-2 sm:p-4 overflow-y-auto" 
      style={{ position: 'fixed', inset: '0px' }}
      onClick={onClose}
    >
      <div 
        className="relative my-2 sm:my-8 mx-auto p-4 sm:p-6 border border-gray-200 dark:border-gray-700 w-full max-w-4xl shadow-lg rounded-lg bg-white dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {customerLike ? 'Booking' : 'Mission'} Details - {booking.name}
            {booking.missionId && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({booking.missionId})</span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Customer Information */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {customerLike ? 'Customer' : 'Mission'} Information
              </h4>
              <div className="space-y-3">
                {booking.source !== 'customer' && (
                  <div className="flex items-center">
                    <FiTarget className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      Source: {bookingSourceLabel(booking.source)}
                    </span>
                  </div>
                )}
                <div className="flex items-center">
                  <FiMail className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-900 dark:text-white">{booking.email}</span>
                </div>
                {customerLike && (
                  <div className="flex items-center">
                    <FiPhone className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-900 dark:text-white">{booking.phone}</span>
                  </div>
                )}
                <div className="flex items-start">
                  <FiMapPin className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-900 dark:text-white">{booking.location}</span>
                </div>
                {booking.payout && (
                  <div className="flex items-center">
                    <FiDollarSign className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      Mission Payout: {booking.payout.toLocaleString()}
                    </span>
                  </div>
                )}
                {booking.travelDistance && (
                  <div className="flex items-center">
                    <FiNavigation className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      Travel: {booking.travelDistance.toFixed(1)} mi
                      {booking.travelTime && ` (${Math.round(booking.travelTime)} min)`}
                    </span>
                  </div>
                )}
                {booking.acceptedAt && (
                  <div className="flex items-center">
                    <FiClock className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      Auto-accepted: {formatDate(booking.acceptedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Service Information */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Service Information</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <FiPackage className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {serviceLabels[booking.service] || booking.service}
                  </span>
                </div>
                {booking.package && (
                  <div>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {packageLabel(booking.package)}
                    </span>
                  </div>
                )}
                <div className="flex items-center">
                  <FiCalendar className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatDate(booking.date, clockOptions)}
                    {booking.hasFlightTime ? ` · ${formatTime(booking.date, clockOptions)}` : ""}
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Project Details */}
          {booking.details && (
            <div className="mt-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Project Details</h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">{booking.details}</p>
              </div>
            </div>
          )}

          {/* Mission Email Content */}
          {booking.missionEmail && (
            <div className="mt-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Original Mission Email</h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {booking.missionEmail}
                </pre>
              </div>
            </div>
          )}

          {/* Admin Form */}
          <form onSubmit={handleSubmit} className="mt-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Admin Actions</h4>
            {readOnlyJob && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                Shown for reference. This completed Zeitview job is not edited from here.
              </p>
            )}
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  disabled={readOnlyJob}
                  className={fieldClass}
                >
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estimated Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {customerLike
                    ? (isQuotePackage(booking.package) ? 'Estimated Price (from)' : 'Estimated Price')
                    : 'Mission Payout'} ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payoutValue}
                  onChange={(e) => handleChange('estimatedPrice', e.target.value)}
                  className={fieldClass}
                  placeholder="0.00"
                  readOnly={amounts.payoutIsFixed || readOnlyJob}
                  disabled={readOnlyJob}
                />
                {amounts.payoutIsFixed && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Mission payout is fixed at ${amounts.payout}
                  </p>
                )}
              </div>

              {/* Final Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Final Price ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalValue}
                  onChange={(e) => handleChange('finalPrice', e.target.value)}
                  className={fieldClass}
                  placeholder="0.00"
                  readOnly={readOnlyJob}
                  disabled={readOnlyJob}
                />
                {amounts.finalPriceFallsBack && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Showing the mission payout, ${amounts.finalPrice}.
                  </p>
                )}
              </div>
            </div>

            {/* Admin Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Admin Notes
              </label>
              <textarea
                value={formData.adminNotes}
                onChange={(e) => handleChange('adminNotes', e.target.value)}
                rows={3}
                maxLength={500}
                readOnly={readOnlyJob}
                disabled={readOnlyJob}
                className={fieldClass}
                placeholder={readOnlyJob ? "No admin notes" : "Add any internal notes about this booking..."}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formData.adminNotes.length}/500 characters
              </p>
            </div>

            {/* Booking Metadata */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Booking Information</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs text-gray-600 dark:text-gray-300">
                <div>
                  <span className="font-medium">Created:</span> {formatDate(booking.createdAt)}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span> {formatDate(booking.updatedAt)}
                </div>
                {booking.ipAddress && (
                  <div>
                    <span className="font-medium">IP Address:</span> {booking.ipAddress}
                  </div>
                )}
              </div>
            </div>

            {(gigActions.showCancel || gigActions.showUndo || booking.cancelStatus) && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <CancelStatusBadge status={booking.cancelStatus} />
                {(gigActions.showCancel || gigActions.showUndo) && (
                  <CancelGigButton job={booking} onUpdated={onGigUpdated} />
                )}
              </div>
            )}

            {booking.unlinkedListing && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                This completed Zeitview job comes from a mission listing and is not a separate booking row.
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
              {/* Delete button - full width on mobile, left-aligned on desktop */}
              {!booking.unlinkedListing && <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <FiTrash2 className="h-4 w-4 mr-2" />
                    Delete Booking
                  </>
                )}
              </button>}
              
              {/* Close and Save buttons - stacked on mobile, side by side on desktop */}
              <div className="flex flex-col sm:flex-row gap-3 sm:space-x-3 sm:gap-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
                >
                  Close
                </button>
                {!booking.unlinkedListing && <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>}
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Booking"
        message={`Are you sure you want to delete this booking?\n\nCustomer: ${booking.name}\nEmail: ${booking.email}\nService: ${serviceLabels[booking.service] || booking.service}\nDate: ${formatDate(booking.date)}\n\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );

  // Use portal to render modal outside of dashboard container
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
} 