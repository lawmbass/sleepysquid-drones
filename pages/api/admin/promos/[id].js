import { connectDB } from '@/libs/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
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

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Promo ID is required' });
  }

  await connectDB();

  switch (req.method) {
    case 'GET':
      return handleGetPromo(req, res, id);
    case 'PATCH':
      return handleUpdatePromo(req, res, id);
    case 'DELETE':
      return handleDeletePromo(req, res, id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetPromo(req, res, id) {
  try {
    const promo = await Promo.findById(id).populate('createdBy', 'name email');
    
    if (!promo) {
      return res.status(404).json({ error: 'Promo not found' });
    }

    return res.status(200).json({
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
          createdBy: promo.createdBy,
          createdAt: promo.createdAt,
          updatedAt: promo.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error fetching promo:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch promo'
    });
  }
}

async function handleUpdatePromo(req, res, id) {
  try {
    const { name, description, discountPercentage, startDate, endDate, isActive } = req.body;

    const promo = await Promo.findById(id);
    if (!promo) {
      return res.status(404).json({ error: 'Promo not found' });
    }

    // Validation for discount percentage
    if (discountPercentage !== undefined) {
      if (discountPercentage < 1 || discountPercentage > 100) {
        return res.status(400).json({
          error: 'Invalid discount percentage',
          message: 'Discount percentage must be between 1 and 100'
        });
      }
    }

    // Validation for date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        return res.status(400).json({
          error: 'Invalid date range',
          message: 'End date must be after start date'
        });
      }

      // Check for overlapping active promos (excluding current promo)
      const overlappingPromo = await Promo.findOne({
        _id: { $ne: id },
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
    }

    // Update fields
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (discountPercentage !== undefined) updateFields.discountPercentage = discountPercentage;
    if (startDate !== undefined) updateFields.startDate = new Date(startDate);
    if (endDate !== undefined) updateFields.endDate = new Date(endDate);
    if (isActive !== undefined) updateFields.isActive = isActive;

    const updatedPromo = await Promo.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    return res.status(200).json({
      data: {
        promo: {
          id: updatedPromo._id,
          name: updatedPromo.name,
          description: updatedPromo.description,
          discountPercentage: updatedPromo.discountPercentage,
          startDate: updatedPromo.startDate,
          endDate: updatedPromo.endDate,
          isActive: updatedPromo.isActive,
          isCurrentlyActive: updatedPromo.isCurrentlyActive,
          createdBy: updatedPromo.createdBy,
          createdAt: updatedPromo.createdAt,
          updatedAt: updatedPromo.updatedAt
        }
      },
      message: 'Promo updated successfully'
    });
  } catch (error) {
    console.error('Error updating promo:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to update promo'
    });
  }
}

async function handleDeletePromo(req, res, id) {
  try {
    const promo = await Promo.findById(id);
    if (!promo) {
      return res.status(404).json({ error: 'Promo not found' });
    }

    await Promo.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Promo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting promo:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete promo'
    });
  }
}