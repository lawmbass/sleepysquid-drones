import { listAllBookings } from "@/libs/db/bookings";
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
    // Extract query parameters for filtering
    const { 
      startDate,
      endDate,
      source,
      status,
      period = '30d' // Default to last 30 days
    } = req.query;

    // Build filter object
    const filters = {};
    
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (source) filters.source = source;
    if (status) filters.status = status;

    // If no date range provided, use period
    if (!startDate && !endDate) {
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '365d': 365
      };
      
      const days = periodMap[period] || 30;
      const endDateTime = new Date();
      const startDateTime = new Date();
      startDateTime.setDate(endDateTime.getDate() - days);
      
      filters.startDate = startDateTime.toISOString();
      filters.endDate = endDateTime.toISOString();
    }

    const bookingMissions = await listAllBookings({
      missionsOnly: true,
      source: filters.source,
      status: filters.status,
      dateFrom: filters.startDate,
      dateTo: filters.endDate,
    });
    const unlinkedMissions = selectUnlinkedEarnings(await listUnlinkedAcceptedListings(), {
      source: filters.source,
      status: filters.status,
      dateFrom: filters.startDate,
      dateTo: filters.endDate,
    });
    const missions = [...bookingMissions, ...unlinkedMissions];

    const statusCounts = {};
    let totalPayout = 0;
    let payoutCount = 0;
    let travelDistanceSum = 0;
    let travelDistanceCount = 0;
    let travelTimeSum = 0;
    let travelTimeCount = 0;
    const processedSourceBreakdown = {};
    const timeMap = new Map();
    const buckets = new Map([
      [0, { _id: 0, count: 0, totalPayout: 0 }],
      [10, { _id: 10, count: 0, totalPayout: 0 }],
      [25, { _id: 25, count: 0, totalPayout: 0 }],
      [50, { _id: 50, count: 0, totalPayout: 0 }],
      ["100+", { _id: "100+", count: 0, totalPayout: 0 }],
    ]);
    const efficiency = {
      totalMissions: missions.length,
      completedMissions: 0,
      cancelledMissions: 0,
      inProgressMissions: 0,
      totalRevenue: 0,
      totalTravelDistance: 0,
      totalTravelTime: 0,
      minPayout: null,
      maxPayout: null,
      minTravelDistance: null,
      maxTravelDistance: null,
    };

    for (const mission of missions) {
      statusCounts[mission.status] = (statusCounts[mission.status] || 0) + 1;
      if (mission.payout != null) {
        totalPayout += mission.payout;
        payoutCount += 1;
        efficiency.totalRevenue += mission.payout;
        efficiency.minPayout = efficiency.minPayout == null ? mission.payout : Math.min(efficiency.minPayout, mission.payout);
        efficiency.maxPayout = efficiency.maxPayout == null ? mission.payout : Math.max(efficiency.maxPayout, mission.payout);
      }
      if (mission.travelDistance != null) {
        travelDistanceSum += mission.travelDistance;
        travelDistanceCount += 1;
        efficiency.totalTravelDistance += mission.travelDistance;
        efficiency.minTravelDistance = efficiency.minTravelDistance == null ? mission.travelDistance : Math.min(efficiency.minTravelDistance, mission.travelDistance);
        efficiency.maxTravelDistance = efficiency.maxTravelDistance == null ? mission.travelDistance : Math.max(efficiency.maxTravelDistance, mission.travelDistance);
        const boundary = mission.travelDistance < 10 ? 0 : mission.travelDistance < 25 ? 10 : mission.travelDistance < 50 ? 25 : mission.travelDistance < 100 ? 50 : "100+";
        const bucket = buckets.get(boundary);
        bucket.count += 1;
        bucket.totalPayout += mission.payout || 0;
      }
      if (mission.travelTime != null) {
        travelTimeSum += mission.travelTime;
        travelTimeCount += 1;
        efficiency.totalTravelTime += mission.travelTime;
      }
      if (mission.status === "completed") efficiency.completedMissions += 1;
      if (mission.status === "cancelled") efficiency.cancelledMissions += 1;
      if (mission.status === "in-progress") efficiency.inProgressMissions += 1;

      if (!processedSourceBreakdown[mission.source]) {
        processedSourceBreakdown[mission.source] = {
          count: 0,
          totalPayout: 0,
          payoutCount: 0,
          distanceSum: 0,
          distanceCount: 0,
          timeSum: 0,
          timeCount: 0,
          statusCounts: {},
        };
      }
      const sourceRow = processedSourceBreakdown[mission.source];
      sourceRow.count += 1;
      sourceRow.statusCounts[mission.status] = (sourceRow.statusCounts[mission.status] || 0) + 1;
      if (mission.payout != null) {
        sourceRow.totalPayout += mission.payout;
        sourceRow.payoutCount += 1;
      }
      if (mission.travelDistance != null) {
        sourceRow.distanceSum += mission.travelDistance;
        sourceRow.distanceCount += 1;
      }
      if (mission.travelTime != null) {
        sourceRow.timeSum += mission.travelTime;
        sourceRow.timeCount += 1;
      }

      if (mission.acceptedAt) {
        const accepted = new Date(mission.acceptedAt);
        const key = `${accepted.getUTCFullYear()}-${accepted.getUTCMonth() + 1}-${accepted.getUTCDate()}`;
        if (!timeMap.has(key)) {
          timeMap.set(key, {
            _id: {
              year: accepted.getUTCFullYear(),
              month: accepted.getUTCMonth() + 1,
              day: accepted.getUTCDate(),
            },
            count: 0,
            totalPayout: 0,
            payoutCount: 0,
          });
        }
        const day = timeMap.get(key);
        day.count += 1;
        if (mission.payout != null) {
          day.totalPayout += mission.payout;
          day.payoutCount += 1;
        }
      }
    }

    const analytics = {
      totalMissions: missions.length,
      totalPayout,
      avgPayout: payoutCount ? totalPayout / payoutCount : 0,
      avgTravelDistance: travelDistanceCount ? travelDistanceSum / travelDistanceCount : 0,
      avgTravelTime: travelTimeCount ? travelTimeSum / travelTimeCount : 0,
      statusCounts,
    };

    for (const sourceRow of Object.values(processedSourceBreakdown)) {
      sourceRow.avgPayout = sourceRow.payoutCount ? sourceRow.totalPayout / sourceRow.payoutCount : 0;
      sourceRow.avgTravelDistance = sourceRow.distanceCount ? sourceRow.distanceSum / sourceRow.distanceCount : 0;
      sourceRow.avgTravelTime = sourceRow.timeCount ? sourceRow.timeSum / sourceRow.timeCount : 0;
    }

    const timeBasedAnalytics = [...timeMap.values()]
      .map((day) => ({
        _id: day._id,
        count: day.count,
        totalPayout: day.totalPayout,
        avgPayout: day.payoutCount ? day.totalPayout / day.payoutCount : 0,
      }))
      .sort((a, b) => a._id.year - b._id.year || a._id.month - b._id.month || a._id.day - b._id.day);

    const locationInsights = [...buckets.values()]
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        ...bucket,
        avgPayout: bucket.count ? bucket.totalPayout / bucket.count : 0,
      }));

    const completionRate = efficiency.totalMissions > 0
      ? (efficiency.completedMissions / efficiency.totalMissions * 100).toFixed(2)
      : 0;

    const revenuePerMile = efficiency.totalTravelDistance > 0
      ? (efficiency.totalRevenue / efficiency.totalTravelDistance).toFixed(2)
      : 0;

    // Return comprehensive analytics
    res.status(200).json({
      success: true,
      data: {
        summary: {
          ...analytics,
          totalRevenue: efficiency.totalRevenue,
          completionRate: parseFloat(completionRate),
          revenuePerMile: parseFloat(revenuePerMile)
        },
        sourceBreakdown: processedSourceBreakdown,
        timeBasedAnalytics,
        performanceMetrics: efficiency,
        locationInsights,
        filters: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          source,
          status,
          period
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          currency: 'USD',
          distanceUnit: 'miles',
          timeUnit: 'minutes'
        }
      }
    });

  } catch (error) {
    console.error('Mission analytics error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch mission analytics'
    });
  }
} 