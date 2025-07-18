import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import bcrypt from 'bcryptjs';

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
      // For OAuth users, they might not have a password
      if (user.password) {
        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
      }

      // Validate new password
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      updateData.password = hashedPassword;
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