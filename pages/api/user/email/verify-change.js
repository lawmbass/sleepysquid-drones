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
    // Explicitly select pendingEmailChange field since it's marked with select: false
    const user = await User.findOne({
      'pendingEmailChange.token': token,
      'pendingEmailChange.expires': { $gt: new Date() }
    }).select('+pendingEmailChange.email +pendingEmailChange.token +pendingEmailChange.expires');

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    if (!user.pendingEmailChange?.email) {
      return res.status(400).json({ 
        message: 'No pending email change found' 
      });
    }

    // Store the pending email for response (before it gets cleared)
    const newEmailAddress = user.pendingEmailChange.email;
    const tokenExpires = user.pendingEmailChange.expires;

    // Check if token is still valid (double-check before proceeding)
    if (tokenExpires <= new Date()) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

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
    // IMPORTANT: Preserve the user's hasAccess status during email change
    
    const updateResult = await User.findOneAndUpdate(
      {
        _id: user._id,
        'pendingEmailChange.token': token,
        'pendingEmailChange.expires': { $gt: new Date() },
        'pendingEmailChange.email': newEmailAddress // Ensure pendingEmail hasn't changed
      },
      {
        email: newEmailAddress,
        'emailVerification.verified': true,
        // Preserve existing hasAccess status - don't let it reset to false
        hasAccess: user.hasAccess,
        $unset: {
          pendingEmailChange: 1
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
      newEmail: newEmailAddress,
      sessionRefreshRequired: true // Flag to indicate frontend should refresh session
    });

  } catch (error) {
    console.error('Email change verification error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}