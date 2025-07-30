import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // Get user from database with all settings
    // Explicitly select email verification fields and password since they're marked with select: false
    const user = await User.findOne({ email: session.user.email })
      .select('+emailVerification +pendingEmailChange +password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has OAuth accounts (is an OAuth-only user)
    const mongoose = (await import('mongoose')).default;
    const oauthAccounts = await mongoose.connection.collection('accounts').findOne({
      userId: user._id
    });

    // Return user settings data
    res.status(200).json({
      profile: {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        company: user.company || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        emailVerified: user.emailVerification?.verified || false,
        pendingEmail: user.pendingEmailChange?.email || null
      },
      preferences: {
        theme: user.preferences?.theme || 'light',
        language: user.preferences?.language || 'en',
        timezone: user.preferences?.timezone || 'UTC',
        dateFormat: user.preferences?.dateFormat || 'MM/DD/YYYY',
        currency: user.preferences?.currency || 'USD'
      },
      notifications: {
        emailNotifications: user.notifications?.emailNotifications !== undefined ? user.notifications.emailNotifications : true,
        pushNotifications: user.notifications?.pushNotifications !== undefined ? user.notifications.pushNotifications : true,
        bookingUpdates: user.notifications?.bookingUpdates !== undefined ? user.notifications.bookingUpdates : true,
        marketingEmails: user.notifications?.marketingEmails !== undefined ? user.notifications.marketingEmails : false,
        weeklyReports: user.notifications?.weeklyReports !== undefined ? user.notifications.weeklyReports : true,
        securityAlerts: user.notifications?.securityAlerts !== undefined ? user.notifications.securityAlerts : true
      },
      security: {
        twoFactorEnabled: user.twoFactorEnabled || false,
        hasPassword: !!user.password,
        isOAuthUser: !!oauthAccounts && !user.password // OAuth user if they have OAuth accounts and no password
      }
    });

  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}