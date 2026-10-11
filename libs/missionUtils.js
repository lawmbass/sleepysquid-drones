import { listAllBookings } from "@/libs/db/bookings";

/**
 * Get mission analytics for non-customer bookings.
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Mission analytics data
 */
export async function getMissionAnalytics(filters = {}) {
  const bookings = await listAllBookings({
    missionsOnly: true,
    source: filters.source,
    status: filters.status,
    dateFrom: filters.startDate,
    dateTo: filters.endDate,
  });

  const statusCounts = {};
  let totalPayout = 0;
  let payoutCount = 0;
  let travelDistanceSum = 0;
  let travelDistanceCount = 0;
  let travelTimeSum = 0;
  let travelTimeCount = 0;

  for (const booking of bookings) {
    statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
    if (booking.payout != null) {
      totalPayout += booking.payout;
      payoutCount += 1;
    }
    if (booking.travelDistance != null) {
      travelDistanceSum += booking.travelDistance;
      travelDistanceCount += 1;
    }
    if (booking.travelTime != null) {
      travelTimeSum += booking.travelTime;
      travelTimeCount += 1;
    }
  }

  return {
    totalMissions: bookings.length,
    totalPayout,
    avgPayout: payoutCount ? totalPayout / payoutCount : 0,
    avgTravelDistance: travelDistanceCount ? travelDistanceSum / travelDistanceCount : 0,
    avgTravelTime: travelTimeCount ? travelTimeSum / travelTimeCount : 0,
    statusCounts,
  };
}
