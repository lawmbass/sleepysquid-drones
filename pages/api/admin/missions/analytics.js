import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { getMissionAnalytics } from "@/libs/missionUtils";

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
    // Connect to MongoDB
    await connectMongo();

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

    // Get comprehensive mission analytics
    const analytics = await getMissionAnalytics(filters);

    // Get detailed source breakdown
    const sourceBreakdown = await Booking.aggregate([
      {
        $match: { 
          source: { $ne: 'customer' },
          ...(filters.startDate && { date: { $gte: new Date(filters.startDate) } }),
          ...(filters.endDate && { date: { $lte: new Date(filters.endDate) } })
        }
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
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

    // Get time-based analytics for trends
    const timeBasedAnalytics = await Booking.aggregate([
      {
        $match: { 
          source: { $ne: 'customer' },
          ...(filters.startDate && { date: { $gte: new Date(filters.startDate) } }),
          ...(filters.endDate && { date: { $lte: new Date(filters.endDate) } })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$acceptedAt' },
            month: { $month: '$acceptedAt' },
            day: { $dayOfMonth: '$acceptedAt' }
          },
          count: { $sum: 1 },
          totalPayout: { $sum: '$payout' },
          avgPayout: { $avg: '$payout' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get performance metrics
    const performanceMetrics = await Booking.aggregate([
      {
        $match: { 
          source: { $ne: 'customer' },
          ...(filters.startDate && { date: { $gte: new Date(filters.startDate) } }),
          ...(filters.endDate && { date: { $lte: new Date(filters.endDate) } })
        }
      },
      {
        $group: {
          _id: null,
          totalMissions: { $sum: 1 },
          completedMissions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledMissions: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          inProgressMissions: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$payout' },
          totalTravelDistance: { $sum: '$travelDistance' },
          totalTravelTime: { $sum: '$travelTime' },
          minPayout: { $min: '$payout' },
          maxPayout: { $max: '$payout' },
          minTravelDistance: { $min: '$travelDistance' },
          maxTravelDistance: { $max: '$travelDistance' }
        }
      }
    ]);

    // Calculate efficiency metrics
    const efficiency = performanceMetrics[0] || {};
    const completionRate = efficiency.totalMissions > 0 
      ? (efficiency.completedMissions / efficiency.totalMissions * 100).toFixed(2)
      : 0;
    
    const revenuePerMile = efficiency.totalTravelDistance > 0
      ? (efficiency.totalRevenue / efficiency.totalTravelDistance).toFixed(2)
      : 0;

    // Get location insights
    const locationInsights = await Booking.aggregate([
      {
        $match: { 
          source: { $ne: 'customer' },
          travelDistance: { $exists: true, $ne: null },
          ...(filters.startDate && { date: { $gte: new Date(filters.startDate) } }),
          ...(filters.endDate && { date: { $lte: new Date(filters.endDate) } })
        }
      },
      {
        $bucket: {
          groupBy: '$travelDistance',
          boundaries: [0, 10, 25, 50, 100],
          default: '100+',
          output: {
            count: { $sum: 1 },
            totalPayout: { $sum: '$payout' },
            avgPayout: { $avg: '$payout' }
          }
        }
      }
    ]);

    // Process source breakdown for better frontend consumption
    const processedSourceBreakdown = sourceBreakdown.reduce((acc, source) => {
      const statusCounts = {};
      source.statusBreakdown.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });

      acc[source._id] = {
        count: source.count,
        totalPayout: source.totalPayout || 0,
        avgPayout: source.avgPayout || 0,
        avgTravelDistance: source.avgTravelDistance || 0,
        avgTravelTime: source.avgTravelTime || 0,
        statusCounts
      };
      return acc;
    }, {});

    // Return comprehensive analytics
    res.status(200).json({
      success: true,
      data: {
        summary: {
          ...analytics,
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