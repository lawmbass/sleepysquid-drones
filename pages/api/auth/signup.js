import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { 
  hashPassword, 
  validatePassword, 
  validateEmail, 
  generateEmailVerificationToken,
  checkRateLimit,
  recordAuthAttempt,
  sanitizeInput
} from "@/libs/auth-utils";
import { sendEmailVerification } from "@/libs/emailService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    
    // Extract and sanitize input data
    const { name, email, password } = req.body;
    
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email)?.toLowerCase();
    const sanitizedPassword = sanitizeInput(password);

    // Validate required fields
    if (!sanitizedEmail || !sanitizedPassword) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(clientIP, 5, 15); // 5 attempts per 15 minutes
    if (rateLimitCheck.isLimited) {
      await recordAuthAttempt(clientIP);
      return res.status(429).json({ 
        message: 'Too many signup attempts. Please try again later.',
        retryAfter: rateLimitCheck.resetTime
      });
    }

    // Validate email format
    if (!validateEmail(sanitizedEmail)) {
      await recordAuthAttempt(clientIP);
      return res.status(400).json({ 
        message: 'Please enter a valid email address' 
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

    // Check if user already exists
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      await recordAuthAttempt(clientIP);
      return res.status(400).json({ 
        message: 'An account with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(sanitizedPassword);

    // Generate email verification token
    const emailVerification = generateEmailVerificationToken();

    // Create new user
    const newUser = new User({
      name: sanitizedName || null,
      email: sanitizedEmail,
      password: hashedPassword,
      emailVerification: {
        verified: false,
        token: emailVerification.token,
        expires: emailVerification.expires
      },
      role: 'client',
      hasAccess: false, // Require email verification before access
      accessHistory: [{
        hasAccess: false,
        changedBy: 'system',
        changedAt: new Date(),
        reason: 'Account created - pending email verification',
        action: 'created'
      }]
    });

    await newUser.save();

    // Send verification email
    try {
      await sendEmailVerification(
        sanitizedEmail, 
        emailVerification.token, 
        sanitizedName
      );
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with signup even if email fails
    }

    // Record successful signup attempt
    await recordAuthAttempt(clientIP);

    // Return success response (don't include sensitive data)
    res.status(201).json({
      message: 'Account created successfully! Please check your email to verify your account.',
      user: {
        email: sanitizedEmail,
        name: sanitizedName,
        emailVerified: false
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'An account with this email already exists' 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred while creating your account. Please try again.' 
    });
  }
}