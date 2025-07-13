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

    // Get current date and calculate date ranges
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    // Get monthly stats for the last 6 months
    const monthlyStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          bookings: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$payout", 0] } }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      },
      {
        $project: {
          month: {
            $let: {
              vars: {
                monthNames: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
              },
              in: { $arrayElemAt: ["$$monthNames", "$_id.month"] }
            }
          },
          bookings: 1,
          revenue: 1
        }
      }
    ]);

    // Get service breakdown
    const serviceBreakdown = await Booking.aggregate([
      {
        $group: {
          _id: "$service",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          service: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", "real-estate"] }, then: "Real Estate" },
                { case: { $eq: ["$_id", "aerial-photography"] }, then: "Aerial Photography" },
                { case: { $eq: ["$_id", "inspection"] }, then: "Inspections" },
                { case: { $eq: ["$_id", "event-coverage"] }, then: "Event Coverage" },
                { case: { $eq: ["$_id", "mapping-surveying"] }, then: "Mapping & Surveying" },
                { case: { $eq: ["$_id", "drone-videography"] }, then: "Drone Videography" },
                { case: { $eq: ["$_id", "custom"] }, then: "Custom" }
              ],
              default: "$_id"
            }
          },
          count: 1
        }
      }
    ]);

    // Calculate percentages for service breakdown
    const totalBookings = serviceBreakdown.reduce((sum, item) => sum + item.count, 0);
    const serviceBreakdownWithPercentages = serviceBreakdown.map(item => ({
      ...item,
      percentage: totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0
    }));

    // Get popular locations
    const popularLocations = await Booking.aggregate([
      {
        $match: {
          location: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$location",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          location: "$_id",
          count: 1
        }
      }
    ]);

    // Get status breakdown
    const statusBreakdown = await Booking.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          status: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", "pending"] }, then: "Pending" },
                { case: { $eq: ["$_id", "accepted"] }, then: "Accepted" },
                { case: { $eq: ["$_id", "completed"] }, then: "Completed" },
                { case: { $eq: ["$_id", "cancelled"] }, then: "Cancelled" }
              ],
              default: "$_id"
            }
          },
          count: 1
        }
      }
    ]);

    // Get source breakdown
    const sourceBreakdown = await Booking.aggregate([
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          source: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", "customer"] }, then: "Customer" },
                { case: { $eq: ["$_id", "zeitview"] }, then: "Zeitview" },
                { case: { $eq: ["$_id", "manual"] }, then: "Manual" }
              ],
              default: "$_id"
            }
          },
          count: 1
        }
      }
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = await Booking.find({
      createdAt: { $gte: thirtyDaysAgo }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('service location status createdAt name email');

    // Get total counts
    const totalStats = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ["$payout", 0] } },
          averagePayout: { $avg: { $ifNull: ["$payout", 0] } }
        }
      }
    ]);

    const stats = totalStats[0] || { totalBookings: 0, totalRevenue: 0, averagePayout: 0 };

    const analyticsData = {
      monthlyStats,
      serviceBreakdown: serviceBreakdownWithPercentages,
      popularLocations,
      statusBreakdown,
      sourceBreakdown,
      recentActivity,
      totalStats: {
        totalBookings: stats.totalBookings,
        totalRevenue: stats.totalRevenue,
        averagePayout: Math.round(stats.averagePayout || 0)
      }
    };

    return res.status(200).json(analyticsData);

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch analytics data'
    });
  }
}