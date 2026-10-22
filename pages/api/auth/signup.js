import { createUser, findUserByEmail } from "@/libs/db/users";
import { isUniqueViolation } from "@/libs/db/shared";
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
import { ADMIN_ROLE_REASON, roleForNewUser } from "@/libs/auth/adminRole";

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

    const existingUser = await findUserByEmail(sanitizedEmail);
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

    const role = roleForNewUser(sanitizedEmail);
    await createUser({
      name: sanitizedName || null,
      email: sanitizedEmail,
      password: hashedPassword,
      emailVerification: {
        verified: false,
        token: emailVerification.token,
        expires: emailVerification.expires
      },
      role,
      roleHistory: role === "admin"
        ? [{
          role: "admin",
          changedAt: new Date().toISOString(),
          changedBy: "system",
          reason: ADMIN_ROLE_REASON,
        }]
        : [],
      hasAccess: false,
      accessHistory: [{
        hasAccess: false,
        changedBy: 'system',
        changedAt: new Date().toISOString(),
        reason: 'Account created - pending email verification',
        action: 'created'
      }]
    });

    // Send verification email
    try {
      await sendEmailVerification(
        sanitizedEmail, 
        emailVerification.token, 
        sanitizedName,
        { accessGranted: role === 'admin' }
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
    if (isUniqueViolation(error)) {
      return res.status(400).json({ 
        message: 'An account with this email already exists' 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred while creating your account. Please try again.' 
    });
  }
}