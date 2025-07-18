import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { adminConfig } from '@/libs/adminConfig';
import connectMongo from '@/libs/mongoose';
import Invitation from '@/models/Invitation';

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only DELETE requests are allowed' 
    });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }

    // Check if user is admin
    if (!adminConfig.isAdmin(session.user.email)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Admin access required' 
      });
    }

    // Connect to database
    await connectMongo();

    const { id } = req.query;

    // Find and delete the invitation
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Invitation not found'
      });
    }

    // Delete the invitation
    await Invitation.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Invitation canceled successfully'
    });

  } catch (error) {
    console.error('Cancel invitation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel invitation'
    });
  }
}