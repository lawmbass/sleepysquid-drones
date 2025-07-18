import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import { adminConfig } from '@/libs/adminConfig';
import connectMongo from '@/libs/mongoose';
import User from '@/models/User';
import Invitation from '@/models/Invitation';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed' 
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

    // Check if user is SleepySquid admin
    if (!session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com')) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only SleepySquid administrators can perform cleanup operations' 
      });
    }

    // Connect to database
    await connectMongo();

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required for duplicate cleanup'
      });
    }

    // Find all users with this email
    const users = await User.find({ email: email.toLowerCase() }).sort({ createdAt: 1 });
    
    if (users.length < 2) {
      return res.status(400).json({
        error: 'No duplicates found',
        message: 'No duplicate users found for this email'
      });
    }

    // Find the corresponding invitation
    const invitation = await Invitation.findOne({ email: email.toLowerCase() });
    
    // Determine which user to keep
    let userToKeep = null;
    let usersToDelete = [];

    if (invitation) {
      // If there's an invitation, keep the user that matches the invitation role
      userToKeep = users.find(user => user.role === invitation.role);
      
      // If no user matches the invitation role, keep the most recent one and update it
      if (!userToKeep) {
        userToKeep = users[users.length - 1];
      }
    } else {
      // No invitation, keep the most recent user
      userToKeep = users[users.length - 1];
    }

    // Mark others for deletion
    usersToDelete = users.filter(user => user._id.toString() !== userToKeep._id.toString());

    // Update the user we're keeping with invitation data if available
    if (invitation) {
      userToKeep.role = invitation.role;
      userToKeep.hasAccess = invitation.hasAccess;
      userToKeep.company = invitation.company || userToKeep.company;
      userToKeep.phone = invitation.phone || userToKeep.phone;
      userToKeep.name = invitation.name || userToKeep.name;
      
      // Add role history
      userToKeep.roleHistory = userToKeep.roleHistory || [];
      userToKeep.roleHistory.push({
        role: invitation.role,
        changedAt: new Date(),
        changedBy: session.user.email,
        reason: 'Cleanup: Applied invitation data to merged user'
      });
      
      await userToKeep.save();
      
      // Mark invitation as accepted
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      await invitation.save();
    }

    // Delete duplicate users
    for (const user of usersToDelete) {
      await User.findByIdAndDelete(user._id);
    }

    return res.status(200).json({
      success: true,
      message: 'Duplicate users cleaned up successfully',
      data: {
        email: email,
        usersRemoved: usersToDelete.length,
        userKept: {
          id: userToKeep._id,
          name: userToKeep.name,
          role: userToKeep.role,
          hasAccess: userToKeep.hasAccess
        },
        invitationProcessed: !!invitation
      }
    });

  } catch (error) {
    console.error('Cleanup duplicates error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cleanup duplicate users'
    });
  }
}