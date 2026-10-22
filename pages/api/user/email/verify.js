import { findUserByEmailVerificationToken, patchUser } from "@/libs/db/users";
import { sendWelcomeEmail } from "@/libs/emailService";
import { adminConfig } from "@/libs/adminConfig";

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

    // Verifying the email no longer grants access: new accounts wait for admin
    // approval. Admins (ADMIN_EMAILS / @sleepysquid.com) and already-approved users keep access.
    const grantAccess = Boolean(user.hasAccess) || adminConfig.isAdmin(user.email);
    await patchUser(user.id, {
      emailVerification: { verified: true, token: null, expires: null },
      ...(grantAccess && !user.hasAccess ? {
        hasAccess: true,
        pushAccessHistory: {
          hasAccess: true,
          changedBy: 'system',
          changedAt: new Date().toISOString(),
          reason: 'Email verified - admin access granted',
          action: 'activated'
        }
      } : {})
    });

    // Welcome email says the account is active, so only send it when it is.
    try {
      if (grantAccess) await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the verification if welcome email fails
    }

    res.status(200).json({
      message: grantAccess
        ? 'Email verified successfully! Your account is now active.'
        : "Email verified! Your account is awaiting approval. We'll email or contact you once it's approved.",
      user: {
        email: user.email,
        name: user.name,
        hasAccess: grantAccess,
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