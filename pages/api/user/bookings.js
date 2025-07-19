import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";

export default async function handler(req, res) {
  // Only allow GET requests for now
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

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.'
    });
  }

  try {
    // Connect to MongoDB
    await connectMongo();

    // Extract query parameters
    const { 
      status, 
      limit = 20, 
      page = 1,
      sort = '-createdAt'
    } = req.query;

    // Build filter object for user's bookings only
    const filter = { 
      email: session.user.email.toLowerCase(),
      source: 'customer' // Only show customer bookings, not automated missions
    };
    
    if (status) filter.status = status;

    // Calculate pagination
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    // Get user's bookings with pagination
    const bookings = await Booking.find(filter)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const totalCount = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get user's booking statistics
    const stats = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$finalPrice', '$estimatedPrice'] } }
        }
      }
    ]);

    // Process stats
    const processedStats = stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalValue: stat.totalValue || 0
      };
      return acc;
    }, {});

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
        stats: processedStats
      }
    });

  } catch (error) {
    console.error('User bookings fetch error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch your bookings'
    });
  }
}