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
    // Explicitly select pendingEmail field since it's marked with select: false
    const user = await User.findOne({
      pendingEmailToken: token,
      pendingEmailExpires: { $gt: new Date() }
    }).select('+pendingEmail +pendingEmailToken +pendingEmailExpires');

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

    // Store the pending email for response (before it gets cleared)
    const newEmailAddress = user.pendingEmail;

    // Check if the new email is already in use by another user (race condition prevention)
    const existingUser = await User.findOne({ 
      email: newEmailAddress,
      _id: { $ne: user._id } // Exclude current user
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'This email address is already in use by another account. Please try a different email.' 
      });
    }

    // Use atomic update to prevent race conditions
    const updateResult = await User.findOneAndUpdate(
      {
        _id: user._id,
        pendingEmailToken: token,
        pendingEmailExpires: { $gt: new Date() },
        pendingEmail: newEmailAddress // Ensure pendingEmail hasn't changed
      },
      {
        email: newEmailAddress,
        emailVerified: true,
        $unset: {
          pendingEmail: 1,
          pendingEmailToken: 1,
          pendingEmailExpires: 1
        }
      },
      { new: true }
    );

    if (!updateResult) {
      return res.status(400).json({ 
        message: 'Email change verification failed. The token may have been used or expired.' 
      });
    }

    res.status(200).json({
      message: 'Email changed and verified successfully',
      newEmail: newEmailAddress
    });

  } catch (error) {
    console.error('Email change verification error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}