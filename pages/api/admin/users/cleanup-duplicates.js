import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import { findUserByEmail } from '@/libs/db/users';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed' 
    });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }

    // Check if user is SleepySquid admin
    if (!session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com')) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only SleepySquid administrators can perform cleanup operations' 
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required for duplicate cleanup'
      });
    }

    // Email is unique in Postgres, so duplicate rows cannot be stored.
    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(400).json({
        error: 'No duplicates found',
        message: 'No user found for this email'
      });
    }

    return res.status(400).json({
      error: 'No duplicates found',
      message: 'No duplicate users found for this email'
    });

  } catch (error) {
    console.error('Cleanup duplicates error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cleanup duplicate users'
    });
  }
}