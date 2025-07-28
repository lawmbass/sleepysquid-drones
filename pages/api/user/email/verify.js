import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
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

    // Connect to database
    await connectMongo();

    // Find user with this verification token
    const user = await User.findOne({
      'emailVerification.token': token,
      'emailVerification.expires': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    // Update user as verified, grant access, and clear verification tokens
    const updatedUser = await User.findByIdAndUpdate(user._id, {
      'emailVerification.verified': true,
      hasAccess: true, // Grant access after email verification
      $unset: {
        'emailVerification.token': 1,
        'emailVerification.expires': 1
      },
      $push: {
        accessHistory: {
          hasAccess: true,
          changedBy: 'system',
          changedAt: new Date(),
          reason: 'Email verified - access granted',
          action: 'activated'
        }
      }
    }, { new: true });

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