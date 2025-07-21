import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";

export default async function handler(req, res) {
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

  if (req.method === 'GET') {
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
        $or: [
          { source: 'customer' }, // Explicit customer bookings
          { source: { $exists: false } }, // Legacy bookings without source field
          { source: null } // Bookings with null source
        ]
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
  } else if (req.method === 'PUT') {
    try {
      // Connect to MongoDB
      await connectMongo();

      const { id, ...updateData } = req.body;
      
      if (!id) {
        return res.status(400).json({
          error: 'Missing job ID',
          message: 'Job ID is required for updates'
        });
      }

      // Find the job and verify ownership
      const job = await Booking.findOne({
        _id: id,
        email: session.user.email.toLowerCase(),
        $or: [
          { source: 'customer' }, // Explicit customer bookings
          { source: { $exists: false } }, // Legacy bookings without source field
          { source: null } // Bookings with null source
        ]
      });

      if (!job) {
        return res.status(404).json({
          error: 'Job not found',
          message: 'Job not found or you do not have permission to edit it'
        });
      }

      // Only allow editing pending jobs
      if (job.status !== 'pending') {
        return res.status(403).json({
          error: 'Cannot edit job',
          message: 'Only pending jobs can be edited'
        });
      }

      // Validate and sanitize update data
      const allowedFields = ['service', 'package', 'date', 'location', 'details', 'phone'];
      const sanitizedUpdates = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          if (typeof updateData[field] === 'string') {
            sanitizedUpdates[field] = updateData[field].trim().replace(/<[^>]*>/g, '');
          } else {
            sanitizedUpdates[field] = updateData[field];
          }
        }
      }

      // Validate date if provided
      if (sanitizedUpdates.date) {
        const bookingDate = new Date(sanitizedUpdates.date);
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 2);
        
        if (bookingDate < minDate || isNaN(bookingDate.getTime())) {
          return res.status(400).json({
            error: 'Invalid date',
            message: 'Booking date must be at least 2 days from today'
          });
        }
      }

      // Update estimated price if package changed
      if (sanitizedUpdates.package) {
        switch (sanitizedUpdates.package) {
          case 'basic':
            sanitizedUpdates.estimatedPrice = 199;
            break;
          case 'standard':
            sanitizedUpdates.estimatedPrice = 399;
            break;
          case 'premium':
            sanitizedUpdates.estimatedPrice = 799;
            break;
          default:
            sanitizedUpdates.estimatedPrice = null;
        }
      }

      // Update the job
      const updatedJob = await Booking.findByIdAndUpdate(
        id,
        { ...sanitizedUpdates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        message: 'Job updated successfully',
        data: updatedJob
      });

    } catch (error) {
      console.error('User booking update error:', error);
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          error: 'Validation failed',
          message: validationErrors.join(', ')
        });
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update your job'
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Connect to MongoDB
      await connectMongo();

      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({
          error: 'Missing job ID',
          message: 'Job ID is required for deletion'
        });
      }

      // Find the job and verify ownership
      const job = await Booking.findOne({
        _id: id,
        email: session.user.email.toLowerCase(),
        $or: [
          { source: 'customer' }, // Explicit customer bookings
          { source: { $exists: false } }, // Legacy bookings without source field
          { source: null } // Bookings with null source
        ]
      });

      if (!job) {
        return res.status(404).json({
          error: 'Job not found',
          message: 'Job not found or you do not have permission to delete it'
        });
      }

      // Only allow deleting pending jobs
      if (job.status !== 'pending') {
        return res.status(403).json({
          error: 'Cannot delete job',
          message: 'Only pending jobs can be deleted'
        });
      }

      // Delete the job
      await Booking.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Job deleted successfully'
      });

    } catch (error) {
      console.error('User booking delete error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete your job'
      });
    }
  } else {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `${req.method} method is not allowed. Supported methods: GET, PUT, DELETE`
    });
  }
}