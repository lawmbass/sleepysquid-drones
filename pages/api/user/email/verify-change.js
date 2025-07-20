import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

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

    // Find user with this pending email verification token
    const user = await User.findOne({
      pendingEmailToken: token,
      pendingEmailExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({ 
        message: 'No pending email change found' 
      });
    }

    // Update user's email and mark as verified
    await User.findByIdAndUpdate(user._id, {
      email: user.pendingEmail,
      emailVerified: true,
      $unset: {
        pendingEmail: 1,
        pendingEmailToken: 1,
        pendingEmailExpires: 1
      }
    });

    res.status(200).json({
      message: 'Email changed and verified successfully',
      newEmail: user.pendingEmail
    });

  } catch (error) {
    console.error('Email change verification error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}