import { findUserByEmailVerificationToken, patchUser } from "@/libs/db/users";
import { sendWelcomeEmail } from "@/libs/emailService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await findUserByEmailVerificationToken(token);

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    await patchUser(user.id, {
      emailVerification: { verified: true, token: null, expires: null },
      hasAccess: true,
      pushAccessHistory: {
        hasAccess: true,
        changedBy: 'system',
        changedAt: new Date().toISOString(),
        reason: 'Email verified - access granted',
        action: 'activated'
      }
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the verification if welcome email fails
    }

    res.status(200).json({
      message: 'Email verified successfully! Your account is now active.',
      user: {
        email: user.email,
        name: user.name,
        hasAccess: true,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}