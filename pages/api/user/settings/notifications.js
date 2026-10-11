import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { findUserByEmail, patchUser } from "@/libs/db/users";

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

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract notification preferences from request
    const {
      emailNotifications,
      pushNotifications,
      bookingUpdates,
      bookingConfirmations,
      statusUpdates,
      marketingEmails,
      weeklyReports,
      securityAlerts
    } = req.body;

    const updatedUser = await patchUser(user.id, {
      notifications: {
        emailNotifications: emailNotifications !== undefined ? emailNotifications : user.notifications?.emailNotifications ?? true,
        pushNotifications: pushNotifications !== undefined ? pushNotifications : user.notifications?.pushNotifications ?? true,
        bookingUpdates: bookingUpdates !== undefined ? bookingUpdates : user.notifications?.bookingUpdates ?? true,
        bookingConfirmations: bookingConfirmations !== undefined ? bookingConfirmations : user.notifications?.bookingConfirmations ?? true,
        statusUpdates: statusUpdates !== undefined ? statusUpdates : user.notifications?.statusUpdates ?? true,
        marketingEmails: marketingEmails !== undefined ? marketingEmails : user.notifications?.marketingEmails ?? false,
        weeklyReports: weeklyReports !== undefined ? weeklyReports : user.notifications?.weeklyReports ?? true,
        securityAlerts: securityAlerts !== undefined ? securityAlerts : user.notifications?.securityAlerts ?? true
      }
    });

    // Return success response
    res.status(200).json({
      message: 'Notification preferences updated successfully',
      notifications: updatedUser.notifications
    });

  } catch (error) {
    console.error('Notification preferences update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}