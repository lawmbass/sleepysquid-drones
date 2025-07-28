import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { validateEmail, sanitizeInput } from "@/libs/auth-utils";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Extract and sanitize input data
    const { email } = req.body;
    const sanitizedEmail = sanitizeInput(email)?.toLowerCase();

    // Validate required fields
    if (!sanitizedEmail) {
      return res.status(400).json({ 
        message: 'Email is required' 
      });
    }

    // Validate email format
    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({ 
        message: 'Please enter a valid email address' 
      });
    }

    // Connect to database
    await connectMongo();

    // Check if user exists
    const user = await User.findOne({ email: sanitizedEmail });
    
    if (!user) {
      return res.status(200).json({
        exists: false,
        message: 'No account found with this email'
      });
    }

    // Check account type
    const mongoose = (await import('mongoose')).default;
    const oauthAccounts = await mongoose.connection.collection('accounts').findOne({
      userId: user._id
    });

    const hasPassword = !!user.password;
    const hasOAuth = !!oauthAccounts;
    
    let accountTypes = [];
    if (hasPassword) accountTypes.push('password');
    if (hasOAuth) accountTypes.push('oauth');

    return res.status(200).json({
      exists: true,
      accountTypes,
      hasPassword,
      hasOAuth,
      emailVerified: user.emailVerification?.verified || false,
      message: hasPassword && hasOAuth ? 
        'Account exists with both password and Google sign-in' :
        hasPassword ? 
        'Account exists with password. You can also sign in with Google to link your accounts.' :
        'Account exists with Google sign-in only'
    });

  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({ 
      message: 'An error occurred while checking the email' 
    });
  }
}