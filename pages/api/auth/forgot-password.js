import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { 
  validateEmail, 
  generatePasswordResetToken,
  checkRateLimit,
  recordAuthAttempt,
  sanitizeInput
} from "@/libs/auth-utils";
import { sendPasswordResetEmail } from "@/libs/emailService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    
    // Extract and sanitize input data
    const { email } = req.body;
    const sanitizedEmail = sanitizeInput(email)?.toLowerCase();

    // Validate required fields
    if (!sanitizedEmail) {
      return res.status(400).json({ 
        message: 'Email is required' 
      });
    }

    // Check rate limiting (more restrictive for password reset)
    const rateLimitCheck = checkRateLimit(clientIP, 3, 15); // 3 attempts per 15 minutes
    if (rateLimitCheck.isLimited) {
      recordAuthAttempt(clientIP);
      return res.status(429).json({ 
        message: 'Too many password reset requests. Please try again later.',
        retryAfter: rateLimitCheck.resetTime
      });
    }

    // Validate email format
    if (!validateEmail(sanitizedEmail)) {
      recordAuthAttempt(clientIP);
      return res.status(400).json({ 
        message: 'Please enter a valid email address' 
      });
    }

    // Connect to database
    await connectMongo();

    // Find user by email (include password reset fields)
    const user = await User.findOne({ email: sanitizedEmail })
      .select('+passwordReset.token +passwordReset.expires +passwordReset.requestedAt');

    // Always return success message to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Check if user has a password (OAuth-only users can't reset password)
      const userWithPassword = await User.findById(user._id).select('+password');
      
      if (!userWithPassword.password) {
        // OAuth-only user - don't send reset email
        recordAuthAttempt(clientIP);
        return res.status(200).json({
          message: 'If an account exists with this email, you will receive password reset instructions shortly.'
        });
      }

      // Check if there's already a recent password reset request (within last 5 minutes)
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (user.passwordReset?.requestedAt && user.passwordReset.requestedAt > fiveMinutesAgo) {
        recordAuthAttempt(clientIP);
        return res.status(429).json({
          message: 'A password reset email was recently sent. Please check your email or wait a few minutes before requesting another.'
        });
      }

      // Generate password reset token
      const passwordReset = generatePasswordResetToken(1); // 1 hour expiration

      // Update user with password reset token
      user.passwordReset = {
        token: passwordReset.token,
        expires: passwordReset.expires,
        requestedAt: passwordReset.requestedAt
      };

      await user.save();

      // Send password reset email
      try {
        await sendPasswordResetEmail(
          sanitizedEmail, 
          passwordReset.token, 
          user.name
        );
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't reveal email sending failure to prevent information disclosure
      }
    }

    // Record attempt
    recordAuthAttempt(clientIP);

    // Always return success message to prevent email enumeration
    res.status(200).json({
      message: 'If an account exists with this email, you will receive password reset instructions shortly.'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ 
      message: 'An error occurred while processing your request. Please try again.' 
    });
  }
}