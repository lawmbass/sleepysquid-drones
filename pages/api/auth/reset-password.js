import { findUserByPasswordResetToken, patchUser } from "@/libs/db/users";
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

    const user = await findUserByPasswordResetToken(sanitizedToken);

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

    // Hash the new password
    const hashedPassword = await hashPassword(sanitizedPassword);

    await patchUser(user.id, {
      password: hashedPassword,
      passwordReset: null,
    });

    // Record successful attempt
    await recordAuthAttempt(clientIP);

    // Return success response
    res.status(200).json({
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'DbError') {
      return res.status(500).json({ 
        message: 'Database error occurred. Please try again in a few moments.' 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Invalid data provided. Please check your input and try again.' 
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      message: 'An error occurred while resetting your password. Please try again.' 
    });
  }
}