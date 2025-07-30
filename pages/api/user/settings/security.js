import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { 
  hashPassword, 
  comparePassword, 
  validatePassword,
  checkRateLimit,
  recordAuthAttempt 
} from "@/libs/auth-utils";

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get user session
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get client IP for rate limiting
    // const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

    // Connect to database
    await connectMongo();

    // Get user from database (include password field)
    const user = await User.findOne({ email: session.user.email }).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract security data from request
    const { currentPassword, newPassword, twoFactorEnabled } = req.body;

    let updateData = {};
    let passwordChanged = false;

    // Handle password change or initial password setup
    if (newPassword) {
      // Check rate limiting for password changes
      const rateLimitCheck = await checkRateLimit(`${session.user.email}-password`, 5, 15);
      if (rateLimitCheck.isLimited) {
        await recordAuthAttempt(`${session.user.email}-password`);
        return res.status(429).json({ 
          message: 'Too many password change attempts. Please try again later.',
          retryAfter: rateLimitCheck.resetTime
        });
      }

      const hasExistingPassword = !!user.password;
      
      // If user has an existing password, they must provide current password
      if (hasExistingPassword && !currentPassword) {
        await recordAuthAttempt(`${session.user.email}-password`);
        return res.status(400).json({ 
          message: 'Current password is required to change your password' 
        });
      }

      // If user has a password, verify current password
      if (hasExistingPassword) {
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          await recordAuthAttempt(`${session.user.email}-password`);
          return res.status(400).json({ 
            message: 'Current password is incorrect' 
          });
        }
      }

      // Validate new password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        await recordAuthAttempt(`${session.user.email}-password`);
        return res.status(400).json({ 
          message: 'New password does not meet requirements',
          errors: passwordValidation.errors
        });
      }

      // Check if new password is different from current (only if they have an existing password)
      if (hasExistingPassword && await comparePassword(newPassword, user.password)) {
        await recordAuthAttempt(`${session.user.email}-password`);
        return res.status(400).json({ 
          message: 'New password must be different from your current password' 
        });
      }

      // Hash new password
      updateData.password = await hashPassword(newPassword);
      passwordChanged = true;

      // Record successful password change attempt
      await recordAuthAttempt(`${session.user.email}-password`);
    }

    // Handle two-factor authentication
    if (twoFactorEnabled !== undefined) {
      updateData.twoFactorEnabled = twoFactorEnabled;
      
      // If enabling 2FA, you might want to generate a secret here
      // For now, we'll just store the preference
      if (twoFactorEnabled) {
        // In a real implementation, you would generate a TOTP secret
        // and return it to the user for QR code generation
        updateData.twoFactorSecret = 'placeholder-secret'; // Replace with actual secret generation
      }
    }

    // Update user security settings
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Return success response (don't include sensitive data)
    const wasInitialPasswordSetup = passwordChanged && !user.password;
    
    res.status(200).json({
      message: passwordChanged ? 
        (wasInitialPasswordSetup ? 
          'Password set successfully! You can now sign in with your email and password.' : 
          'Security settings updated successfully. Your password has been changed.') : 
        'Security settings updated successfully',
      twoFactorEnabled: updatedUser.twoFactorEnabled || false,
      passwordChanged,
      initialPasswordSetup: wasInitialPasswordSetup
    });

  } catch (error) {
    console.error('Security update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}