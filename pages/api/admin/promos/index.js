import connectMongo from '@/libs/mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import Promo from '@/models/Promo';

export default async function handler(req, res) {
  // Check authentication and admin access
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const isAdmin = session.user.role === 'admin' || 
                  session.user.email?.toLowerCase()?.endsWith('@sleepysquid.com');
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  await connectMongo();

  switch (req.method) {
    case 'GET':
      return handleGetPromos(req, res);
    case 'POST':
      return handleCreatePromo(req, res, session.user);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetPromos(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (status === 'active') {
      const now = new Date();
      query = {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      };
    } else if (status === 'inactive') {
      query = { isActive: false };
    } else if (status === 'expired') {
      const now = new Date();
      query = {
        isActive: true,
        endDate: { $lt: now }
      };
    } else if (status === 'upcoming') {
      const now = new Date();
      query = {
        isActive: true,
        startDate: { $gt: now }
      };
    }

    const promos = await Promo.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Promo.countDocuments(query);

    // Map _id to id for frontend consistency
    const mappedPromos = promos.map(promo => ({
      ...promo.toObject(),
      id: promo._id.toString()
    }));

    return res.status(200).json({
      data: {
        promos: mappedPromos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching promos:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch promos'
    });
  }
}

async function handleCreatePromo(req, res, user) {
  try {
    const { name, description, discountPercentage, startDate, endDate } = req.body;

    // Validation
    if (!name || !description || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'All fields are required'
      });
    }

    if (discountPercentage < 1 || discountPercentage > 100) {
      return res.status(400).json({
        error: 'Invalid discount percentage',
        message: 'Discount percentage must be between 1 and 100'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'End date must be after start date'
      });
    }

    // Check for overlapping active promos
    const overlappingPromo = await Promo.findOne({
      isActive: true,
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingPromo) {
      return res.status(400).json({
        error: 'Overlapping promo',
        message: 'There is already an active promo during this time period'
      });
    }

    // Handle different user ID formats from NextAuth session
    let createdBy;
    if (user._id) {
      createdBy = user._id;
    } else if (user.id) {
      createdBy = user.id;
    } else {
      // If no ID available, use email as fallback (not ideal but prevents errors)
      createdBy = user.email;
    }

    const promo = new Promo({
      name,
      description,
      discountPercentage,
      startDate: start,
      endDate: end,
      createdBy
    });

    await promo.save();

    return res.status(201).json({
      data: {
        promo: {
          id: promo._id,
          name: promo.name,
          description: promo.description,
          discountPercentage: promo.discountPercentage,
          startDate: promo.startDate,
          endDate: promo.endDate,
          isActive: promo.isActive,
          isCurrentlyActive: promo.isCurrentlyActive,
          createdBy: {
            name: user.name,
            email: user.email
          },
          createdAt: promo.createdAt
        }
      },
      message: 'Promo created successfully'
    });
  } catch (error) {
    console.error('Error creating promo:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create promo'
    });
  }
}