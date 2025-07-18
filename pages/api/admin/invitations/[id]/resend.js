import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import { adminConfig } from '@/libs/adminConfig';
import connectMongo from '@/libs/mongoose';
import Invitation from '@/models/Invitation';
import { sendEmail } from '@/libs/mailgun';
import config from '@/config';

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

    const { id } = req.query;

    // Find the invitation
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Invitation not found'
      });
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid invitation',
        message: 'Invitation has already been accepted or expired'
      });
    }

    // Update invitation timestamps
    invitation.invitedAt = new Date();
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    invitation.invitedBy = session.user.email;
    await invitation.save();

    // Generate the invitation link
    const baseUrl = process.env.NEXTAUTH_URL || `https://${config.domainName}`;
    const invitationLink = `${baseUrl}/invite?token=${invitation.token}`;

    // Send invitation email
    await sendInvitationEmail(invitation.email, invitation.name, invitationLink, invitation.role, session.user.name);

    return res.status(200).json({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        resentAt: invitation.invitedAt,
        expiresAt: invitation.expiresAt
      }
    });

  } catch (error) {
    console.error('Resend invitation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to resend invitation'
    });
  }
}

async function sendInvitationEmail(email, name, invitationLink, role, inviterName) {
  const subject = `You're invited to join SleepySquid Drones`;
  
  const roleDescriptions = {
    'admin': 'Administrator with full system access',
    'pilot': 'Pilot with mission management capabilities',
    'client': 'Client with booking and project management access',
    'user': 'User with basic platform access'
  };
  
  const roleDescription = roleDescriptions[role] || 'Platform user';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to SleepySquid Drones</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: #f8fafc;
          padding: 30px;
          border-radius: 0 0 10px 10px;
          border: 1px solid #e2e8f0;
        }
        .button {
          display: inline-block;
          background: #2563eb;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .role-badge {
          background: #1e40af;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .footer {
          text-align: center;
          color: #64748b;
          font-size: 14px;
          margin-top: 30px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚁 SleepySquid Drones</h1>
        <p>Reminder: You're invited to join our platform!</p>
      </div>
      
      <div class="content">
        <p>Hi ${name},</p>
        
        <p>This is a reminder that ${inviterName} has invited you to join <strong>SleepySquid Drones</strong> as a <span class="role-badge">${role}</span>.</p>
        
        <p><strong>Your Role:</strong> ${roleDescription}</p>
        
        <p>To get started, click the button below to sign in with your Google account:</p>
        
        <div style="text-align: center;">
          <a href="${invitationLink}" style="display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Join SleepySquid Drones</a>
        </div>
        
        <p><small><strong>Important:</strong> This invitation expires in 7 days. If you don't have a Google account, you can create one for free at <a href="https://accounts.google.com">accounts.google.com</a>.</small></p>
        
        <p>Once you sign in, you'll have access to:</p>
        <ul>
          <li>Your personalized dashboard</li>
          <li>Project and booking management</li>
          <li>Real-time mission tracking</li>
          <li>Communication tools</li>
        </ul>
        
        <p>If you have any questions, feel free to reach out to us at <a href="mailto:${config.mailgun.supportEmail}">${config.mailgun.supportEmail}</a>.</p>
        
        <p>Welcome to the team!</p>
        
        <p>Best regards,<br>
        The SleepySquid Drones Team</p>
      </div>
      
      <div class="footer">
        <p>SleepySquid Drones - Professional Drone Services</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
  
  const text = `
Hi ${name},

This is a reminder that ${inviterName} has invited you to join SleepySquid Drones as a ${role}.

Your Role: ${roleDescription}

To get started, visit this link to sign in with your Google account:
${invitationLink}

This invitation expires in 7 days.

Once you sign in, you'll have access to your personalized dashboard, project management, mission tracking, and communication tools.

If you have any questions, contact us at ${config.mailgun.supportEmail}.

Welcome to the team!

Best regards,
The SleepySquid Drones Team

---
SleepySquid Drones - Professional Drone Services
If you didn't expect this invitation, you can safely ignore this email.
  `;
  
  try {
    await sendEmail({
      to: email,
      subject,
      text,
      html,
      replyTo: config.mailgun.supportEmail
    });
    console.log(`✅ Invitation email resent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to resend invitation email to ${email}:`, error);
    throw new Error('Failed to resend invitation email');
  }
}