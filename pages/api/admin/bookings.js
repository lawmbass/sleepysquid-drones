import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import { adminRateLimit } from "@/libs/rateLimit";

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

  // Basic authentication check - you should implement proper auth
  const authHeader = req.headers.authorization;
  const expectedAuth = process.env.ADMIN_API_KEY; // Add this to your .env file
  
  if (!expectedAuth) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Admin authentication not configured'
    });
  }
  
  if (!authHeader || authHeader !== `Bearer ${expectedAuth}`) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid authentication required'
    });
  }

  try {
    // Connect to MongoDB
    await connectMongo();

    // Extract query parameters
    const { 
      status, 
      service, 
      limit = 50, 
      page = 1,
      sort = '-createdAt',
      email,
      date_from,
      date_to
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (service) filter.service = service;
    if (email) filter.email = { $regex: email, $options: 'i' };
    
    // Date range filter
    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = new Date(date_from);
      if (date_to) filter.date.$lte = new Date(date_to);
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
          totalValue: { $sum: '$estimatedPrice' }
        }
      }
    ]);

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
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalValue: stat.totalValue || 0
          };
          return acc;
        }, {}),
        filters: {
          status,
          service,
          email,
          date_from,
          date_to
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