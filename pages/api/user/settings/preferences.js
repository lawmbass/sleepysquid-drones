import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { findOrCreateSettingsUser, patchUser } from "@/libs/db/users";

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

    const user = await findOrCreateSettingsUser(session.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract preferences data from request
    const { theme, language, timezone, dateFormat, currency } = req.body;

    // Validate preferences
    const validThemes = ['light', 'dark', 'auto'];
    const validLanguages = ['en', 'es', 'fr', 'de'];
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD'];

    if (theme && !validThemes.includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme' });
    }

    if (language && !validLanguages.includes(language)) {
      return res.status(400).json({ message: 'Invalid language' });
    }

    if (currency && !validCurrencies.includes(currency)) {
      return res.status(400).json({ message: 'Invalid currency' });
    }

    const updatedUser = await patchUser(user.id, {
      preferences: {
        theme: theme || user.preferences?.theme || 'light',
        language: language || user.preferences?.language || 'en',
        timezone: timezone || user.preferences?.timezone || 'UTC',
        dateFormat: dateFormat || user.preferences?.dateFormat || 'MM/DD/YYYY',
        currency: currency || user.preferences?.currency || 'USD'
      }
    });

    // Return success response
    res.status(200).json({
      message: 'Preferences updated successfully',
      preferences: updatedUser.preferences
    });

  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}