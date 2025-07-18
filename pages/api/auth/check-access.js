import connectMongo from '@/libs/mongoose';
import User from '@/models/User';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Connect to database
    await connectMongo();

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ 
        hasAccess: false, 
        error: 'User not found' 
      });
    }

    // Return user access status
    return res.status(200).json({
      hasAccess: user.hasAccess || false,
      role: user.role,
      email: user.email
    });

  } catch (error) {
    console.error('Error checking user access:', error);
    return res.status(500).json({ 
      hasAccess: false, 
      error: 'Internal server error' 
    });
  }
}