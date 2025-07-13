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

    // Get basic counts and stats
    const totalBookings = await Booking.countDocuments();
    const totalRevenue = await Booking.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$payout", 0] } } } }
    ]);
    const avgPayout = await Booking.aggregate([
      { $group: { _id: null, avg: { $avg: { $ifNull: ["$payout", 0] } } } }
    ]);

    // Get recent bookings for activity feed
    const recentBookings = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('service location status createdAt name email source');

    // Get service breakdown
    const serviceStats = await Booking.aggregate([
      {
        $group: {
          _id: "$service",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get status breakdown
    const statusStats = await Booking.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get source breakdown
    const sourceStats = await Booking.aggregate([
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get location stats
    const locationStats = await Booking.aggregate([
      {
        $match: { location: { $exists: true, $ne: "" } }
      },
      {
        $group: {
          _id: "$location",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get monthly stats for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
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
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Format the response
    const response = {
      totalStats: {
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        avgPayout: Math.round(avgPayout[0]?.avg || 0)
      },
      recentActivity: recentBookings,
      serviceBreakdown: serviceStats.map(item => ({
        service: formatServiceName(item._id),
        count: item.count,
        percentage: totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0
      })),
      statusBreakdown: statusStats.map(item => ({
        status: formatStatusName(item._id),
        count: item.count
      })),
      sourceBreakdown: sourceStats.map(item => ({
        source: formatSourceName(item._id),
        count: item.count
      })),
      locationStats: locationStats.map(item => ({
        location: item._id,
        count: item.count
      })),
      monthlyStats: monthlyStats.map(item => ({
        month: getMonthName(item._id.month),
        year: item._id.year,
        bookings: item.bookings,
        revenue: item.revenue
      }))
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch analytics data'
    });
  }
}

// Helper functions
function formatServiceName(service) {
  const serviceMap = {
    'aerial-photography': 'Aerial Photography',
    'drone-videography': 'Drone Videography',
    'mapping-surveying': 'Mapping & Surveying',
    'real-estate': 'Real Estate',
    'inspection': 'Inspection',
    'event-coverage': 'Event Coverage',
    'custom': 'Custom'
  };
  return serviceMap[service] || service;
}

function formatStatusName(status) {
  const statusMap = {
    'pending': 'Pending',
    'accepted': 'Accepted',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
}

function formatSourceName(source) {
  const sourceMap = {
    'customer': 'Customer',
    'zeitview': 'Zeitview',
    'manual': 'Manual'
  };
  return sourceMap[source] || source;
}

function getMonthName(monthNumber) {
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthNumber] || monthNumber;
}