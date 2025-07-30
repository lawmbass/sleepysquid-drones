import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { 
  hashPassword, 
  validatePassword, 
  isTokenExpired,
  checkRateLimit,
  recordAuthAttempt,
  sanitizeInput
} from "@/libs/auth-utils";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    
    // Extract and sanitize input data
    const { token, password } = req.body;
    const sanitizedToken = sanitizeInput(token);
    const sanitizedPassword = sanitizeInput(password);

    // Validate required fields
    if (!sanitizedToken || !sanitizedPassword) {
      return res.status(400).json({ 
        message: 'Token and password are required' 
      });
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(clientIP, 5, 15); // 5 attempts per 15 minutes
    if (rateLimitCheck.isLimited) {
      await recordAuthAttempt(clientIP);
      return res.status(429).json({ 
        message: 'Too many password reset attempts. Please try again later.',
        retryAfter: rateLimitCheck.resetTime
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(sanitizedPassword);
    if (!passwordValidation.isValid) {
      await recordAuthAttempt(clientIP);
      return res.status(400).json({ 
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Connect to database
    await connectMongo();

    // Find user by password reset token (include password reset fields)
    const user = await User.findOne({ 
      'passwordReset.token': sanitizedToken 
    }).select('+passwordReset.token +passwordReset.expires +password');

    if (!user) {
      await recordAuthAttempt(clientIP);
      return res.status(400).json({ 
        message: 'Invalid or expired password reset token' 
      });
    }

    // Check if token has expired
    if (isTokenExpired(user.passwordReset.expires)) {
      await recordAuthAttempt(clientIP);
      return res.status(400).json({ 
        message: 'Password reset token has expired. Please request a new one.' 
      });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(sanitizedPassword);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.passwordReset = {
      token: undefined,
      expires: undefined,
      requestedAt: undefined
    };

    await user.save();

    // Record successful attempt
    await recordAuthAttempt(clientIP);

    // Return success response
    res.status(200).json({
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      message: 'An error occurred while resetting your password. Please try again.' 
    });
  }
}