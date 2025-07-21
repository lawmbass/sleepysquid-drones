/**
 * Utility functions for booking operations
 */

/**
 * Get duration from package selection
 * @param {string} packageType - The package type (basic, standard, premium)
 * @returns {string} The duration string
 */
export const getDurationFromPackage = (packageType) => {
  switch (packageType) {
    case 'basic':
      return '1 hour';
    case 'standard':
      return '2 hours';
    case 'premium':
      return '4 hours';
    default:
      return 'To be determined';
  }
};

/**
 * Get display duration for a booking
 * @param {Object} booking - The booking object
 * @returns {string} The duration to display
 */
export const getBookingDuration = (booking) => {
  // If booking has a stored duration, use it (for legacy bookings)
  if (booking.duration) {
    return booking.duration;
  }
  
  // Otherwise, derive from package
  return getDurationFromPackage(booking.package);
};