import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { adminConfig } from '../../../../libs/adminConfig';
import connectMongo from '../../../../libs/mongo';

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

    // Check if user is admin
    if (!adminConfig.isAdmin(session.user.email)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Admin access required' 
      });
    }

    // Connect to database
    await connectMongo();

    return handleSendInvitation(req, res, session);
  } catch (error) {
    console.error('Invitation API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process invitation'
    });
  }
}

async function handleSendInvitation(req, res, session) {
  try {
    const { name, email, company, phone, role, hasAccess } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name and email are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Validate role if provided
    const assignedRole = role || 'user';
    const validRoles = ['user', 'client', 'pilot', 'admin'];
    if (!validRoles.includes(assignedRole)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be one of: user, client, pilot, admin'
      });
    }

    // Only allow role assignment by SleepySquid admins
    if (role && role !== 'user') {
      if (!adminConfig.isAdmin(session.user.email)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Only SleepySquid administrators can assign roles'
        });
      }
    }

    // Prevent creating admin users for non-sleepysquid emails
    if (assignedRole === 'admin' && !email.toLowerCase().endsWith('@sleepysquid.com')) {
      return res.status(403).json({
        error: 'Invalid admin assignment',
        message: 'Only SleepySquid emails can be assigned admin roles'
      });
    }

    // Create invitation token (you might want to use a more secure token generation)
    const invitationToken = generateInvitationToken();
    
    // Store invitation data temporarily (you might want to use a dedicated invitations collection)
    const invitationData = {
      email: email.toLowerCase(),
      name,
      company,
      phone,
      role: assignedRole,
      hasAccess: hasAccess || false,
      invitedBy: session.user.email,
      invitedAt: new Date(),
      token: invitationToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    // In a real implementation, you'd:
    // 1. Store this in a database (invitations collection)
    // 2. Send an actual email with the invitation link
    // 3. Handle the invitation acceptance in your auth flow

    // For now, we'll simulate the invitation being sent
    console.log('Invitation sent:', invitationData);

    // Generate the invitation link
    const invitationLink = `${process.env.NEXTAUTH_URL}/invite?token=${invitationToken}`;

    // TODO: Send actual email here
    // await sendInvitationEmail(email, name, invitationLink, assignedRole);

    return res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        email,
        name,
        role: assignedRole,
        invitationLink // Remove this in production
      }
    });

  } catch (error) {
    console.error('Send invitation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send invitation'
    });
  }
}

function generateInvitationToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

// TODO: Implement email sending
async function sendInvitationEmail(email, name, invitationLink, role) {
  // Use your preferred email service (SendGrid, AWS SES, etc.)
  // Email template should include:
  // - Welcome message
  // - Invitation link
  // - Role information
  // - Expiration notice
  console.log(`Would send invitation email to ${email}`);
}