import config from "@/config";
import { sendEmail } from "@/libs/mailgun";

/**
 * Sends a booking confirmation email to the customer
 * @param {Object} booking - The booking object
 * @param {Object} options - Additional options
 * @param {boolean} options.hasAccount - Whether the user has an account
 * @param {string} options.loginUrl - URL for login/account creation
 */
export const sendBookingConfirmationEmail = async (booking, options = {}) => {
  const { hasAccount = false, loginUrl = null } = options;
  
  const subject = `Booking Confirmation - ${booking.service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Service`;
  
  const serviceDisplayName = booking.service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const packageDisplayName = booking.package ? booking.package.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
  const formattedDate = new Date(booking.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Account creation section for non-authenticated users
  const accountSection = !hasAccount ? `
    <div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <h3 style="color: #1f2937; margin-top: 0; font-size: 18px;">Manage Your Bookings</h3>
      <p style="color: #4b5563; margin-bottom: 15px;">Create an account to easily manage your bookings, view status updates, and track your service history.</p>
      <a href="${loginUrl || `https://${config.domainName}/login`}" 
         style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Create Account & Manage Bookings
      </a>
      <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">
        You can access your booking using ID: <strong>${booking._id}</strong>
      </p>
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Booking Confirmation</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin-bottom: 10px;">${config.appName}</h1>
        <p style="color: #6b7280; margin: 0;">Professional Drone Services</p>
      </div>

      <div style="background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h2 style="color: #166534; margin-top: 0; display: flex; align-items: center;">
          <span style="margin-right: 10px;">✅</span> Booking Confirmed!
        </h2>
        <p style="color: #166534; margin: 0; font-size: 16px;">
          Thank you ${booking.name}! We've received your booking request and will contact you within 24 hours to confirm the details.
        </p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin-top: 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Booking Details</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563; width: 35%;">Booking ID:</td>
            <td style="padding: 12px 0; color: #1f2937;">${booking._id}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">Service:</td>
            <td style="padding: 12px 0; color: #1f2937;">${serviceDisplayName}</td>
          </tr>
          ${packageDisplayName ? `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">Package:</td>
            <td style="padding: 12px 0; color: #1f2937;">${packageDisplayName}</td>
          </tr>
          ` : ''}
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">Date:</td>
            <td style="padding: 12px 0; color: #1f2937;">${formattedDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">Location:</td>
            <td style="padding: 12px 0; color: #1f2937;">${booking.location}</td>
          </tr>

          ${booking.estimatedPrice ? `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">Estimated Price:</td>
            <td style="padding: 12px 0; color: #1f2937; font-weight: 600;">$${booking.estimatedPrice}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">Status:</td>
            <td style="padding: 12px 0;">
              <span style="background-color: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
                Pending Confirmation
              </span>
            </td>
          </tr>
        </table>
        
        ${booking.details ? `
        <div style="margin-top: 20px;">
          <h4 style="color: #4b5563; margin-bottom: 10px;">Additional Details:</h4>
          <p style="color: #1f2937; background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 0;">
            ${booking.details}
          </p>
        </div>
        ` : ''}
      </div>

      ${accountSection}

      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin-top: 0;">What happens next?</h3>
        <ol style="color: #4b5563; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Our team will review your booking request</li>
          <li style="margin-bottom: 8px;">We'll contact you within 24 hours to confirm availability</li>
          <li style="margin-bottom: 8px;">We'll discuss any specific requirements and finalize details</li>
          <li style="margin-bottom: 8px;">You'll receive a final confirmation with payment instructions</li>
        </ol>
      </div>

      <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
        <p style="color: #6b7280; margin-bottom: 10px;">Need to make changes or have questions?</p>
        <p style="color: #6b7280; margin-bottom: 20px;">
          Contact us at <a href="mailto:${config.mailgun.supportEmail}" style="color: #3b82f6;">${config.mailgun.supportEmail}</a>
        </p>
        
        <div style="color: #9ca3af; font-size: 14px;">
          <p style="margin: 5px 0;">${config.appName}</p>
          <p style="margin: 5px 0;">Professional drone photography, videography, and specialized aerial services</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${config.appName} - Booking Confirmation

Thank you ${booking.name}! We've received your booking request and will contact you within 24 hours to confirm the details.

BOOKING DETAILS:
================
Booking ID: ${booking._id}
Service: ${serviceDisplayName}
${packageDisplayName ? `Package: ${packageDisplayName}\n` : ''}Date: ${formattedDate}
Location: ${booking.location}
${booking.estimatedPrice ? `Estimated Price: $${booking.estimatedPrice}\n` : ''}Status: Pending Confirmation

${booking.details ? `Additional Details: ${booking.details}\n\n` : ''}

${!hasAccount ? `MANAGE YOUR BOOKINGS:
====================
Create an account to easily manage your bookings, view status updates, and track your service history.
Visit: ${loginUrl || `https://${config.domainName}/login`}
Your booking ID: ${booking._id}

` : ''}WHAT HAPPENS NEXT:
==================
1. Our team will review your booking request
2. We'll contact you within 24 hours to confirm availability  
3. We'll discuss any specific requirements and finalize details
4. You'll receive a final confirmation with payment instructions

Questions? Contact us at ${config.mailgun.supportEmail}

${config.appName}
Professional drone photography, videography, and specialized aerial services
  `;

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
export const sendEmailVerification = async (email, verificationToken, name = '') => {
  const verifyUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/verify-email?token=${verificationToken}`;
  const subject = 'Verify Your Email - SleepySquid Drones';
  const greeting = name ? `Hi ${name}` : 'Hi there';
  
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
        <p style="color: #4b5563; margin-bottom: 20px;">Thank you for creating an account with SleepySquid Drones. To complete your registration and start using our services, please verify your email address by clicking the button below:</p>
        
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
          <h3 style="color: #1f2937; margin-top: 0; margin-bottom: 15px;">Once verified, you'll be able to:</h3>
          <ul style="color: #4b5563; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Access your dashboard</li>
            <li style="margin-bottom: 8px;">Book drone services</li>
            <li style="margin-bottom: 8px;">Manage your account settings</li>
            <li style="margin-bottom: 8px;">Receive important updates</li>
          </ul>
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

Once verified, you'll be able to:
- Access your dashboard
- Book drone services  
- Manage your account settings
- Receive important updates

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
    const User = (await import("@/models/User")).default;
    const user = await User.findOne({ email: email.toLowerCase() });
    
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