import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { bookingRateLimit } from "@/libs/rateLimit";
import { sendBookingConfirmationEmail, shouldSendEmailNotification } from "@/libs/emailService";
import config from "@/config";

// Apply rate limiting middleware
const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    bookingRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many booking attempts. Please wait before trying again.'
        });
        return reject(result);
      }
      resolve();
    });
  });
};

export default async function handler(req, res) {
  // Apply rate limiting
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return; // Response already sent by rate limiter
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  try {
    // Connect to MongoDB
    await connectMongo();

    // Extract booking data from request body
    const {
      service,
      package: packageType,
      date,
      location,
      duration,
      details,
      name,
      email,
      phone,
      recaptchaToken,
    } = req.body;

    // Check if user is authenticated via session
    let isSessionAuthenticated = false;
    
    // Import session handling at the top of the try block
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/libs/next-auth");
    
    try {
      const session = await getServerSession(req, res, authOptions);
      isSessionAuthenticated = session && session.user && session.user.email;
    } catch (sessionError) {
      // Session check failed, continue with reCAPTCHA validation
      console.log('Session check failed, requiring reCAPTCHA');
    }

    // For session-authenticated users, bypass reCAPTCHA
    if (!isSessionAuthenticated) {
      // Verify reCAPTCHA token (required for non-authenticated users)
      if (!recaptchaToken) {
        return res.status(400).json({
          error: 'Missing reCAPTCHA',
          message: 'Please complete the reCAPTCHA verification'
        });
      }

      // Ensure reCAPTCHA is configured on the server
      if (!process.env.RECAPTCHA_SECRET_KEY) {
        return res.status(500).json({
          error: 'reCAPTCHA not configured',
          message: 'reCAPTCHA verification is required but not configured on the server'
        });
      }

      try {
        const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        });

        const recaptchaData = await recaptchaResponse.json();

        // reCAPTCHA v2 only returns success: true/false (no score)
        // reCAPTCHA v3 would return both success and score (0.0-1.0)
        if (!recaptchaData.success) {
          return res.status(400).json({
            error: 'reCAPTCHA verification failed',
            message: 'Please try again with the reCAPTCHA verification'
          });
        }
      } catch (recaptchaError) {
        console.error('reCAPTCHA verification error:', recaptchaError);
        return res.status(500).json({
          error: 'reCAPTCHA verification failed',
          message: 'Unable to verify reCAPTCHA. Please try again.'
        });
      }
    }

    // Enhanced input validation and sanitization
    if (!service || !date || !location || !name || !email || !phone) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please fill in all required fields'
      });
    }

    // Sanitize string inputs to prevent XSS
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      return str.trim().replace(/<[^>]*>/g, ''); // Remove HTML tags
    };

    const sanitizedData = {
      service: sanitizeString(service),
      package: packageType ? sanitizeString(packageType) : null,
      location: sanitizeString(location),
      details: details ? sanitizeString(details) : '',
      name: sanitizeString(name),
      email: sanitizeString(email).toLowerCase(),
      phone: sanitizeString(phone)
    };

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedData.email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Phone number validation (basic)
    const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
    if (!phoneRegex.test(sanitizedData.phone)) {
      return res.status(400).json({
        error: 'Invalid phone number',
        message: 'Please provide a valid phone number'
      });
    }

    // Validate date (should be at least 7 days from now)
    const bookingDate = new Date(date);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 7);
    
    if (bookingDate < minDate || isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Booking date must be at least 7 days from today'
      });
    }

    // Validate service type
    const validServices = [
      'aerial-photography', 'drone-videography', 'mapping-surveying', 
      'real-estate', 'inspection', 'event-coverage', 'custom'
    ];
    if (!validServices.includes(sanitizedData.service)) {
      return res.status(400).json({
        error: 'Invalid service',
        message: 'Please select a valid service type'
      });
    }

    // Estimate price based on package or default pricing
    let estimatedPrice = null;
    if (sanitizedData.package) {
      const validPackages = ['basic', 'standard', 'premium'];
      if (!validPackages.includes(sanitizedData.package)) {
        return res.status(400).json({
          error: 'Invalid package',
          message: 'Please select a valid package type'
        });
      }
      
      switch (sanitizedData.package) {
        case 'basic':
          estimatedPrice = 199;
          break;
        case 'standard':
          estimatedPrice = 399;
          break;
        case 'premium':
          estimatedPrice = 799;
          break;
      }
    }

    // Check for duplicate bookings (same email and date)
    // Create separate date objects to prevent mutation of the original bookingDate
    const startOfDay = new Date(bookingDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(bookingDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingBooking = await Booking.findOne({
      email: sanitizedData.email,
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    });

    if (existingBooking) {
      return res.status(409).json({
        error: 'Duplicate booking',
        message: 'You already have a booking for this date. Please choose a different date.'
      });
    }

    // Create new booking with sanitized data
    const newBooking = new Booking({
      source: 'customer', // Mark as customer booking for dashboard visibility
      service: sanitizedData.service,
      package: sanitizedData.package,
      date: bookingDate,
      location: sanitizedData.location,
      details: sanitizedData.details,
      name: sanitizedData.name,
      email: sanitizedData.email,
      phone: sanitizedData.phone,
      estimatedPrice,
      status: 'pending',
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress, // For tracking
      userAgent: req.headers['user-agent'] // For tracking
    });

    // Save to database
    const savedBooking = await newBooking.save();

    // Check if user has an account
    const existingUser = await User.findOne({ email: sanitizedData.email.toLowerCase() });
    const hasAccount = !!existingUser;

    // Send confirmation email based on user preferences
    let emailSent = false;
    try {
      if (hasAccount) {
        // For authenticated users, check their notification preferences
        const shouldSend = await shouldSendEmailNotification(sanitizedData.email, 'bookingConfirmations');
        if (shouldSend) {
          await sendBookingConfirmationEmail(savedBooking, { 
            hasAccount: true,
            loginUrl: `https://${process.env.VERCEL_URL || config.domainName}/dashboard`
          });
          emailSent = true;
        }
      } else {
        // For non-authenticated users, always send confirmation with account creation prompt
        await sendBookingConfirmationEmail(savedBooking, { 
          hasAccount: false,
          loginUrl: `https://${process.env.VERCEL_URL || config.domainName}/login`
        });
        emailSent = true;
      }
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    // Return success response (limited data for security)
    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Booking submitted successfully! We will contact you soon to confirm the details. A confirmation email has been sent.'
        : 'Booking submitted successfully! We will contact you soon to confirm the details.',
      booking: {
        id: savedBooking._id,
        service: savedBooking.service,
        date: savedBooking.date,
        location: savedBooking.location,
        status: savedBooking.status,
        estimatedPrice: savedBooking.estimatedPrice,
      },
      hasAccount,
      emailSent
    });

  } catch (error) {
    console.error('Booking submission error:', error);
    
    // Handle duplicate booking scenario
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate booking',
        message: 'A booking with similar details already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        message: validationErrors.join(', ')
      });
    }

    // Generic server error (don't expose sensitive details)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong while processing your booking. Please try again.'
    });
  }
} 