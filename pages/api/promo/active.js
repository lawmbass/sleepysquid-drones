import { connectDB } from '@/libs/mongodb';
import Promo from '@/models/Promo';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    
    const activePromo = await Promo.getActivePromo();
    
    if (!activePromo) {
      return res.status(200).json({ 
        hasActivePromo: false,
        promo: null 
      });
    }

    return res.status(200).json({
      hasActivePromo: true,
      promo: {
        id: activePromo._id,
        name: activePromo.name,
        description: activePromo.description,
        discountPercentage: activePromo.discountPercentage,
        startDate: activePromo.startDate,
        endDate: activePromo.endDate,
        isCurrentlyActive: activePromo.isCurrentlyActive
      }
    });
  } catch (error) {
    console.error('Error fetching active promo:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch active promo'
    });
  }
}