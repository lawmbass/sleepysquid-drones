import connectMongo from '@/libs/mongoose';
import Invitation from '@/models/Invitation';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed' 
    });
  }

  try {
    // Connect to database
    await connectMongo();

    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Invitation token is required'
      });
    }

    // Find valid invitation by token
    const invitation = await Invitation.findValidInvitation(token);

    if (!invitation) {
      return res.status(404).json({
        error: 'Invalid invitation',
        message: 'Invitation not found or has expired'
      });
    }

    // Return invitation data
    return res.status(200).json({
      success: true,
      invitation: {
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        validUntil: invitation.expiresAt,
        token: invitation.token
      }
    });

  } catch (error) {
    console.error('Validate invitation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate invitation'
    });
  }
}