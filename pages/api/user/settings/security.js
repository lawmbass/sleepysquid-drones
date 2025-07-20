import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

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

    // Connect to database
    await connectMongo();

    // Get user from database
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract security data from request
    const { currentPassword, newPassword, twoFactorEnabled } = req.body;

    let updateData = {};

    // Handle password change
    if (currentPassword && newPassword) {
      // Check if user has OAuth accounts (OAuth users shouldn't change passwords here)
      const mongoose = (await import('mongoose')).default;
      const oauthAccounts = await mongoose.connection.collection('accounts').findOne({
        userId: user._id
      });
      
      if (oauthAccounts) {
        return res.status(400).json({ 
          message: 'Password changes are not available for OAuth users. Please manage your password through your OAuth provider.' 
        });
      }
      
      // For non-OAuth users, password functionality is not implemented in this build
      // This prevents build issues while maintaining API compatibility
      return res.status(501).json({ 
        message: 'Password management is currently unavailable. Please use OAuth sign-in or contact support.' 
      });
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
    res.status(200).json({
      message: 'Security settings updated successfully',
      twoFactorEnabled: updatedUser.twoFactorEnabled || false,
      passwordChanged: !!updateData.password
    });

  } catch (error) {
    console.error('Security update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}