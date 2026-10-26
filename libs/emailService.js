import config from "@/config";
import { sendEmail } from "@/libs/mailgun";
import { buildBookingEmail } from "@/libs/droneEmails.mjs";
import { isQuotePackage, packageLabel } from "@/libs/manualBooking";

/**
 * Sends a booking confirmation email to the customer
 * @param {Object} booking - The booking object
 * @param {Object} options - Additional options
 * @param {boolean} options.hasAccount - Whether the user has an account
 * @param {string} options.loginUrl - URL for login/account creation
 */
export const sendBookingConfirmationEmail = async (booking, options = {}) => {
  if (!booking || !booking.email) {
    console.warn("Booking confirmation email skipped: booking has no email address");
    return { skipped: true, reason: "no_email" };
  }
  const { hasAccount = false, loginUrl = null } = options;
  
  const subject = `Booking Confirmation - ${booking.service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Service`;
  
  const serviceDisplayName = booking.service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const packageDisplayName = booking.package ? packageLabel(booking.package) : null;
  const estimatedPriceLabel = booking.estimatedPrice
    ? `${isQuotePackage(booking.package) ? "from " : ""}$${booking.estimatedPrice}`
    : null;
  const formattedDate = new Date(booking.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const { html: htmlContent, text: textContent } = buildBookingEmail({
    id: booking._id,
    name: booking.name,
    serviceDisplayName,
    packageDisplayName,
    formattedDate,
    location: booking.location,
    estimatedPriceLabel,
    details: booking.details,
  }, {
    hasAccount,
    loginUrl: loginUrl || `https://${config.domainName}/login`,
    appName: config.appName,
    supportEmail: config.mailgun.supportEmail,
  });

  await sendEmail({
    to: booking.email,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: config.mailgun.supportEmail
  });
};

/**
 * Sends a password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Password reset token
 * @param {string} name - User's name
 */
export const sendPasswordResetEmail = async (email, resetToken, name = '') => {
  const resetUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password - SleepySquid Drones';
  const greeting = name ? `Hi ${name}` : 'Hi there';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin-bottom: 10px;">${config.appName}</h1>
        <p style="color: #6b7280; margin: 0;">Professional Drone Services</p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">${greeting},</p>
        <p style="color: #4b5563; margin-bottom: 20px;">We received a request to reset your password for your SleepySquid Drones account. If you made this request, click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Reset My Password
          </a>
        </div>
        
        <p style="color: #4b5563; margin-bottom: 15px;">Or copy and paste this link into your browser:</p>
        <p style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 14px; color: #1f2937;">
          ${resetUrl}
        </p>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0;"><strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you didn't request this password reset, you can safely ignore this email.</p>
        </div>
        
        <p style="color: #4b5563;">If you continue to have problems, please contact our support team.</p>
        <p style="color: #4b5563;">Best regards,<br>The SleepySquid Drones Team</p>
      </div>

      <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 14px;">
        <p style="margin-bottom: 10px;">This email was sent to ${email}. If you didn't request this, please ignore this email.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
${config.appName} - Password Reset Request

${greeting},

We received a request to reset your password for your SleepySquid Drones account.

To reset your password, visit this link: ${resetUrl}

This link will expire in 1 hour for your security.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
The SleepySquid Drones Team

---
This email was sent to ${email}. If you didn't request this, please ignore this email.
© ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.
  `;
  
  await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: config.mailgun.supportEmail
  });
};

/**
 * Sends an email verification email
 * @param {string} email - Recipient email
 * @param {string} verificationToken - Email verification token
 * @param {string} name - User's name
 */
export const sendEmailVerification = async (email, verificationToken, name = '', { accessGranted = false } = {}) => {
  const verifyUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/verify-email?token=${verificationToken}`;
  const subject = 'Verify Your Email - SleepySquid Drones';
  const greeting = name ? `Hi ${name}` : 'Hi there';
  const nextStepsText = accessGranted
    ? 'Once verified, you can sign in and use your dashboard right away.'
    : "Once verified, your account will be reviewed by our team. We'll email or contact you as soon as it's approved, and then you can sign in to your dashboard.";
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin-bottom: 10px;">${config.appName}</h1>
        <p style="color: #6b7280; margin: 0;">Professional Drone Services</p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">Welcome to SleepySquid Drones!</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">${greeting},</p>
        <p style="color: #4b5563; margin-bottom: 20px;">Thank you for creating an account with SleepySquid Drones. To complete your registration, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" 
             style="display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Verify My Email
          </a>
        </div>
        
        <p style="color: #4b5563; margin-bottom: 15px;">Or copy and paste this link into your browser:</p>
        <p style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 14px; color: #1f2937;">
          ${verifyUrl}
        </p>
        
        <div style="background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <p style="color: #1e40af; margin: 0;"><strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification email.</p>
        </div>
        
        <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0; margin-bottom: 10px;">What happens next</h3>
          <p style="color: #4b5563; margin: 0;">${nextStepsText}</p>
        </div>
        
        <p style="color: #4b5563; margin-bottom: 15px;">If you didn't create this account, you can safely ignore this email.</p>
        <p style="color: #4b5563;">Welcome aboard!<br>The SleepySquid Drones Team</p>
      </div>

      <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 14px;">
        <p style="margin-bottom: 10px;">This email was sent to ${email}. If you didn't create this account, please ignore this email.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
${config.appName} - Welcome! Please Verify Your Email

${greeting},

Thank you for creating an account with SleepySquid Drones. To complete your registration, please verify your email address by visiting this link:

${verifyUrl}

This verification link will expire in 24 hours.

What happens next:
${nextStepsText}

If you didn't create this account, you can safely ignore this email.

Welcome aboard!
The SleepySquid Drones Team

---
This email was sent to ${email}. If you didn't create this account, please ignore this email.
© ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.
  `;
  
  await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: config.mailgun.supportEmail
  });
};

/**
 * Sends a welcome email after successful verification
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
export const sendWelcomeEmail = async (email, name = '') => {
  const dashboardUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/dashboard`;
  const subject = 'Welcome to SleepySquid Drones!';
  const greeting = name ? `Hi ${name}` : 'Hi there';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Welcome to SleepySquid Drones</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin-bottom: 10px;">🚁 ${config.appName}</h1>
        <p style="color: #6b7280; margin: 0;">Professional Drone Services</p>
      </div>

      <div style="background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h2 style="color: #166534; margin-top: 0;">Your account is ready!</h2>
        <p style="color: #166534; margin: 0; font-size: 16px;">${greeting}, congratulations! Your email has been verified and your SleepySquid Drones account is now active.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardUrl}" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Go to Dashboard
        </a>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin-top: 0; margin-bottom: 20px;">What you can do now:</h3>
        
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div style="background-color: #f8fafc; border-radius: 6px; padding: 15px;">
            <strong style="color: #1f2937;">📅 Book Services</strong><br>
            <span style="color: #4b5563;">Schedule aerial photography, videography, mapping, or inspection services.</span>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 6px; padding: 15px;">
            <strong style="color: #1f2937;">🎯 Manage Projects</strong><br>
            <span style="color: #4b5563;">Track your bookings, view project status, and access completed work.</span>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 6px; padding: 15px;">
            <strong style="color: #1f2937;">⚙️ Customize Settings</strong><br>
            <span style="color: #4b5563;">Update your profile, preferences, and notification settings.</span>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 6px; padding: 15px;">
            <strong style="color: #1f2937;">📞 Get Support</strong><br>
            <span style="color: #4b5563;">Contact our team for questions, custom projects, or technical support.</span>
          </div>
        </div>
        
        <p style="color: #4b5563; margin-top: 20px;">If you have any questions or need assistance getting started, don't hesitate to reach out to our support team at <a href="mailto:${config.mailgun.supportEmail}" style="color: #3b82f6;">${config.mailgun.supportEmail}</a>.</p>
        
        <p style="color: #4b5563;">Thank you for choosing SleepySquid Drones for your aerial service needs!</p>
        <p style="color: #4b5563;">FAA Part 107 Certified &amp; Insured. $1M liability coverage.</p>
        <p style="color: #4b5563;">Best regards,<br>The SleepySquid Drones Team</p>
      </div>

      <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 14px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
${config.appName} - Your account is ready!

${greeting},

Congratulations! Your email has been verified and your SleepySquid Drones account is now active.

Visit your dashboard: ${dashboardUrl}

What you can do now:
- Book aerial photography, videography, mapping, or inspection services
- Track your bookings and view project status
- Update your profile and preferences
- Contact our support team for assistance

If you have any questions or need assistance getting started, contact us at ${config.mailgun.supportEmail}.

Thank you for choosing SleepySquid Drones!
FAA Part 107 Certified & Insured. $1M liability coverage.

Best regards,
The SleepySquid Drones Team

---
© ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.
  `;
  
  try {
    await sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
      replyTo: config.mailgun.supportEmail
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email as it's not critical
    return { success: false, error: error.message };
  }
};

/**
 * Checks if a user should receive email notifications
 * @param {string} email - User email
 * @param {string} notificationType - Type of notification ('bookingConfirmations', 'bookingUpdates', etc.)
 * @returns {Promise<boolean>}
 */
export const shouldSendEmailNotification = async (email, notificationType = 'emailNotifications') => {
  try {
    const { findUserByEmail } = await import("@/libs/db/users");
    const user = await findUserByEmail(email.toLowerCase());
    
    if (!user) {
      // For non-registered users, always send booking confirmations
      return notificationType === 'bookingConfirmations' || notificationType === 'emailNotifications';
    }
    
    // Check if user has email notifications enabled and the specific notification type
    const emailEnabled = user.notifications?.emailNotifications !== false;
    const specificEnabled = user.notifications?.[notificationType] !== false;
    
    return emailEnabled && specificEnabled;
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    // Default to sending notifications if there's an error
    return true;
  }
};