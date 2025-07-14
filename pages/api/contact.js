import connectMongo from "@/libs/mongoose";
import { sendEmail } from "@/libs/mailgun";
import { getAdminEmails } from "@/libs/adminConfig";
import config from "@/config";

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
    // Connect to MongoDB (for potential logging in the future)
    await connectMongo();

    // Extract contact data from request body
    const {
      name,
      email,
      subject,
      message,
      recaptchaToken,
    } = req.body;

    // Verify reCAPTCHA token
    if (!recaptchaToken) {
      return res.status(400).json({
        error: 'Missing reCAPTCHA',
        message: 'Please complete the reCAPTCHA verification'
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
    const adminEmails = getAdminEmails();
    
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
    const timestamp = new Date().toLocaleString();

    const emailSubject = `New Contact Form Submission: ${sanitizedData.subject}`;
    
    const emailText = `
New contact form submission received:

From: ${sanitizedData.name}
Email: ${sanitizedData.email}
Subject: ${sanitizedData.subject}

Message:
${sanitizedData.message}

---
Technical Details:
Submitted: ${timestamp}
IP Address: ${clientIp}
User Agent: ${userAgent}
`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Contact Form Submission</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
    .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #495057; }
    .value { margin-top: 5px; padding: 10px; background: white; border-radius: 4px; border: 1px solid #ced4da; }
    .message-box { background: white; padding: 15px; border-radius: 4px; border: 1px solid #ced4da; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🚁 New Contact Form Submission</h2>
      <p>SleepySquid Drones - Contact Request</p>
    </div>
    
    <div class="content">
      <div class="field">
        <div class="label">From:</div>
        <div class="value">${sanitizedData.name}</div>
      </div>
      
      <div class="field">
        <div class="label">Email:</div>
        <div class="value">
          <a href="mailto:${sanitizedData.email}">${sanitizedData.email}</a>
        </div>
      </div>
      
      <div class="field">
        <div class="label">Subject:</div>
        <div class="value">${sanitizedData.subject}</div>
      </div>
      
      <div class="field">
        <div class="label">Message:</div>
        <div class="message-box">${sanitizedData.message}</div>
      </div>
      
      <div class="field">
        <div class="label">Submitted:</div>
        <div class="value">${timestamp}</div>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Technical Details:</strong></p>
      <p>IP Address: ${clientIp}</p>
      <p>User Agent: ${userAgent}</p>
      <p>This email was automatically generated from the SleepySquid Drones contact form.</p>
    </div>
  </div>
</body>
</html>
`;

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
      message: 'Message sent successfully! We will get back to you within 24 hours.'
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