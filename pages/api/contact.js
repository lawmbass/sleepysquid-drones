import { verifyRecaptcha } from "@/libs/recaptcha";
import { sendEmail } from "@/libs/mailgun";
import adminConfig from "@/libs/adminConfig";
import { buildContactEmail } from "@/libs/droneEmails.mjs";

// Rate limiting for contact form (more restrictive than bookings)
const contactAttempts = new Map();
const CONTACT_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 3, // Max 3 contact attempts per IP per 15 minutes
};

const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - CONTACT_RATE_LIMIT.windowMs;
    
    // Clean old attempts
    for (const [ip, attempts] of contactAttempts.entries()) {
      contactAttempts.set(ip, attempts.filter(time => time > windowStart));
      if (contactAttempts.get(ip).length === 0) {
        contactAttempts.delete(ip);
      }
    }
    
    // Check current IP
    const ipAttempts = contactAttempts.get(clientIp) || [];
    if (ipAttempts.length >= CONTACT_RATE_LIMIT.maxAttempts) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many contact attempts. Please wait 15 minutes before trying again.'
      });
      return reject(new Error('Rate limit exceeded'));
    }
    
    // Add current attempt
    ipAttempts.push(now);
    contactAttempts.set(clientIp, ipAttempts);
    
    resolve();
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

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  try {
    // Extract contact data from request body
    const {
      name,
      email,
      subject,
      message,
      recaptchaToken,
    } = req.body;

    // Verify reCAPTCHA token (always required)
    const captcha = await verifyRecaptcha(recaptchaToken, req.headers['x-forwarded-for'] || req.socket?.remoteAddress);
    if (!captcha.ok) {
      return res.status(captcha.status).json({ error: captcha.error, message: captcha.message });
    }

    // Enhanced input validation
    if (!name || !email || !subject || !message) {
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
      name: sanitizeString(name),
      email: sanitizeString(email).toLowerCase(),
      subject: sanitizeString(subject),
      message: sanitizeString(message)
    };

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedData.email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Validate field lengths
    if (sanitizedData.name.length > 100) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Name cannot exceed 100 characters'
      });
    }

    if (sanitizedData.subject.length > 200) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Subject cannot exceed 200 characters'
      });
    }

    if (sanitizedData.message.length > 2000) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Message cannot exceed 2000 characters'
      });
    }

    // Get admin emails
    const adminEmails = adminConfig.getAllowedEmails();
    
    if (!adminEmails || adminEmails.length === 0) {
      console.error('No admin emails configured for contact notifications');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Unable to process contact request. Please try again later.'
      });
    }

    // Prepare email content
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const emailSubject = `New Contact Form Submission: ${sanitizedData.subject}`;
    
    const { html: emailHtml, text: emailText } = buildContactEmail({ ...sanitizedData, timestamp, clientIp, userAgent });

    // Send email to all admin emails
    const emailPromises = adminEmails.map(adminEmail => 
      sendEmail({
        to: adminEmail,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        replyTo: sanitizedData.email, // Allow admins to reply directly to the contact
      })
    );

    await Promise.all(emailPromises);

    // Log the contact for security purposes
    console.log(`Contact form submission from ${sanitizedData.email} (${clientIp}) - Subject: ${sanitizedData.subject}`);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Message sent successfully! We will get back to you as soon as we can.'
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    
    // Generic server error (don't expose sensitive details)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong while sending your message. Please try again or contact us directly.'
    });
  }
}