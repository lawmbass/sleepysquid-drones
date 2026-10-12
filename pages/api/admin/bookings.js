import { displayValue, listAllBookings, listBookings } from "@/libs/db/bookings";
import { listUnlinkedAcceptedListings } from "@/libs/db/listings";
import { selectUnlinkedEarnings } from "@/libs/earnings";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";

// Apply rate limiting middleware
const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many admin requests. Please wait before trying again.'
        });
        return reject(result);
      }
      resolve();
    });
  });
};

export default async function handler(req, res) {
  // Apply rate limiting
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return; // Response already sent by rate limiter
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed'
    });
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // SECURITY: Use NextAuth.js session-based authentication
  const session = await getServerSession(req, res, authOptions);
  
  // Check if user is authenticated
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.'
    });
  }
  
  // Check if user is authorized as admin
  const isAdmin = adminConfig.isAdmin(session.user.email);
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Insufficient permissions.'
    });
  }

  try {
    const { 
      status, 
      service,
      source,
      limit = 50, 
      page = 1,
      sort = '-createdAt',
      email,
      date_from,
      date_to,
      payout_min,
      payout_max,
      travel_distance_max
    } = req.query;

    const filters = {
      status,
      service,
      source,
      email,
      dateFrom: date_from,
      dateTo: date_to,
      payoutMin: payout_min,
      payoutMax: payout_max,
      travelDistanceMax: travel_distance_max,
    };

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const { bookings, count: totalCount } = await listBookings(filters, {
      sort,
      limit: limitNum,
      offset: skip,
    });
    const totalPages = Math.ceil(totalCount / limitNum);

    const allBookings = await listAllBookings({});
    const unlinkedMissions = selectUnlinkedEarnings(await listUnlinkedAcceptedListings());
    const stats = {};
    const processedSourceStats = {};
    const missions = [];

    for (const booking of allBookings) {
      const value = displayValue(booking);
      if (!stats[booking.status]) stats[booking.status] = { count: 0, totalValue: 0 };
      stats[booking.status].count += 1;
      stats[booking.status].totalValue += value;

      const sourceKey = booking.source || "customer";
      if (!processedSourceStats[sourceKey]) processedSourceStats[sourceKey] = { count: 0, totalValue: 0 };
      processedSourceStats[sourceKey].count += 1;
      processedSourceStats[sourceKey].totalValue += value;

      if (booking.source && booking.source !== "customer") missions.push(booking);
    }

    const unlinkedPayout = unlinkedMissions.reduce((sum, mission) => sum + (mission.payout || 0), 0);
    stats.unlinkedAccepted = { count: 0, totalValue: unlinkedPayout };
    for (const mission of unlinkedMissions) {
      missions.push(mission);
      const sourceKey = mission.source || "zeitview";
      if (!processedSourceStats[sourceKey]) processedSourceStats[sourceKey] = { count: 0, totalValue: 0 };
      processedSourceStats[sourceKey].totalValue += mission.payout || 0;
    }

    const payouts = missions.map((booking) => booking.payout).filter((value) => value != null);
    const distances = missions.map((booking) => booking.travelDistance).filter((value) => value != null);
    const times = missions.map((booking) => booking.travelTime).filter((value) => value != null);
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

    const processedMissionStats = {
      totalMissions: missions.length,
      totalPayout: payouts.reduce((sum, value) => sum + value, 0),
      avgPayout: average(payouts),
      avgTravelDistance: average(distances),
      avgTravelTime: average(times),
    };

    // Calculate customer bookings count
    const customerBookingsCount = processedSourceStats.customer?.count || 0;

    // Return bookings with metadata
    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        },
        stats: {
          ...stats,
          customerBookings: customerBookingsCount
        },
        missionStats: processedMissionStats,
        sourceStats: processedSourceStats,
        filters: {
          status,
          service,
          source,
          email,
          date_from,
          date_to,
          payout_min,
          payout_max,
          travel_distance_max
        }
      }
    });

  } catch (error) {
    console.error('Admin bookings fetch error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bookings'
    });
  }
} 