import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { 
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
    const { token } = req.body;
    const sanitizedToken = sanitizeInput(token);

    // Validate required fields
    if (!sanitizedToken) {
      return res.status(400).json({ 
        message: 'Token is required' 
      });
    }

    // Check rate limiting (more lenient for validation)
    const rateLimitCheck = await checkRateLimit(clientIP, 10, 15); // 10 attempts per 15 minutes
    if (rateLimitCheck.isLimited) {
      await recordAuthAttempt(clientIP);
      return res.status(429).json({ 
        message: 'Too many validation attempts. Please try again later.',
        retryAfter: rateLimitCheck.resetTime
      });
    }

    // Connect to database
    await connectMongo();

    // Find user by password reset token (include password reset fields)
    const user = await User.findOne({ 
      'passwordReset.token': sanitizedToken 
    }).select('+passwordReset.token +passwordReset.expires');

    if (!user || !user.passwordReset || !user.passwordReset.token) {
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

    // Record successful validation attempt
    await recordAuthAttempt(clientIP);

    // Return success response
    res.status(200).json({
      message: 'Token is valid',
      valid: true
    });

  } catch (error) {
    console.error('Token validation error:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoServerError' || error.name === 'MongoError') {
      return res.status(500).json({ 
        message: 'Database error occurred. Please try again in a few moments.' 
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      message: 'An error occurred while validating the token. Please try again.' 
    });
  }
}