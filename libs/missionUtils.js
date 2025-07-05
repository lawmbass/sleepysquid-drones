// Mission analytics utilities
import Booking from '../models/Booking';

/**
 * Get mission analytics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Mission analytics data
 */
export async function getMissionAnalytics(filters = {}) {
  try {
    const matchStage = {
      source: { $ne: 'customer' }
    };
    
    // Add date filtering if provided
    if (filters.startDate || filters.endDate) {
      matchStage.date = {};
      if (filters.startDate) matchStage.date.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.date.$lte = new Date(filters.endDate);
    }
    
    const analytics = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalMissions: { $sum: 1 },
          totalPayout: { $sum: '$payout' },
          avgPayout: { $avg: '$payout' },
          avgTravelDistance: { $avg: '$travelDistance' },
          avgTravelTime: { $avg: '$travelTime' },
          statusBreakdown: {
            $push: {
              status: '$status',
              payout: '$payout'
            }
          }
        }
      }
    ]);
    
    const result = analytics[0] || {
      totalMissions: 0,
      totalPayout: 0,
      avgPayout: 0,
      avgTravelDistance: 0,
      avgTravelTime: 0,
      statusBreakdown: []
    };
    
    // Process status breakdown
    const statusCounts = {};
    result.statusBreakdown.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });
    
    result.statusCounts = statusCounts;
    delete result.statusBreakdown;
    
    return result;
  } catch (error) {
    console.error('Error getting mission analytics:', error);
    throw error;
  }
}

 