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

    // Find user with this verification token
    const user = await User.findOne({
      'emailVerification.token': token,
      'emailVerification.expires': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    // Update user as verified and clear verification tokens
    await User.findByIdAndUpdate(user._id, {
      'emailVerification.verified': true,
      $unset: {
        'emailVerification.token': 1,
        'emailVerification.expires': 1
      }
    });

    res.status(200).json({
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}