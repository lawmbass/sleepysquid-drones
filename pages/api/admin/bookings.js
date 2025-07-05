import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
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
    // Connect to MongoDB
    await connectMongo();

    // Extract query parameters
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

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (service) filter.service = service;
    if (source) filter.source = source;
    if (email) filter.email = { $regex: email, $options: 'i' };
    
    // Date range filter
    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = new Date(date_from);
      if (date_to) filter.date.$lte = new Date(date_to);
    }

    // Mission-specific filters
    if (payout_min || payout_max) {
      filter.payout = {};
      if (payout_min) filter.payout.$gte = parseFloat(payout_min);
      if (payout_max) filter.payout.$lte = parseFloat(payout_max);
    }

    if (travel_distance_max) {
      filter.travelDistance = { $lte: parseFloat(travel_distance_max) };
    }

    // Calculate pagination
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    // Get bookings with pagination
    const bookings = await Booking.find(filter)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const totalCount = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get booking statistics
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { 
            $sum: {
              $cond: [
                { $ne: ['$payout', null] },
                '$payout',
                { $ifNull: ['$finalPrice', '$estimatedPrice'] }
              ]
            }
          }
        }
      }
    ]);

    // Get mission-specific statistics
    const missionStats = await Booking.aggregate([
      {
        $match: { source: { $ne: 'customer' } }
      },
      {
        $group: {
          _id: null,
          totalMissions: { $sum: 1 },
          totalPayout: { $sum: '$payout' },
          avgPayout: { $avg: '$payout' },
          avgTravelDistance: { $avg: '$travelDistance' },
          avgTravelTime: { $avg: '$travelTime' },
          sourceBreakdown: {
            $push: {
              source: '$source',
              payout: '$payout'
            }
          }
        }
      }
    ]);

    // Get source breakdown
    const sourceStats = await Booking.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          totalValue: { 
            $sum: {
              $cond: [
                { $ne: ['$payout', null] },
                '$payout',
                { $ifNull: ['$finalPrice', '$estimatedPrice'] }
              ]
            }
          }
        }
      }
    ]);

    // Process mission statistics
    const processedMissionStats = missionStats[0] || {
      totalMissions: 0,
      totalPayout: 0,
      avgPayout: 0,
      avgTravelDistance: 0,
      avgTravelTime: 0
    };

    // Process source statistics
    const processedSourceStats = sourceStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalValue: stat.totalValue || 0
      };
      return acc;
    }, {});

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
          ...stats.reduce((acc, stat) => {
            acc[stat._id] = {
              count: stat.count,
              totalValue: stat.totalValue || 0
            };
            return acc;
          }, {}),
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