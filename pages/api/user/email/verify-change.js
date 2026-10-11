import { findUserByEmailExcluding, findUserByPendingEmailToken, patchUser } from "@/libs/db/users";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await findUserByPendingEmailToken(token);

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

    const existingUser = await findUserByEmailExcluding(newEmailAddress, user.id);

    if (existingUser) {
      return res.status(400).json({ 
        message: 'This email address is already in use by another account. Please try a different email.' 
      });
    }

    const stillPending = await findUserByPendingEmailToken(token);
    if (!stillPending || stillPending.pendingEmailChange?.email !== newEmailAddress) {
      return res.status(400).json({
        message: 'Email change verification failed. The token may have been used or expired.'
      });
    }

    const updateResult = await patchUser(user.id, {
      email: newEmailAddress,
      emailVerification: { verified: true, token: null, expires: null },
      hasAccess: user.hasAccess,
      pendingEmailChange: null,
    });
    
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