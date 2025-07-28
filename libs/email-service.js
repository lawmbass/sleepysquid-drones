import nodemailer from 'nodemailer';
import config from '@/config';

/**
 * Create email transporter based on available configuration
 */
function createTransporter() {
  // For production, you might want to use Mailgun, SendGrid, or other services
  // This is a basic SMTP configuration
  if (process.env.MAILGUN_API_KEY) {
    // Use Mailgun if available
    const mg = require('mailgun.js');
    const mailgun = new mg.default();
    const client = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY,
    });
    
    return {
      sendMail: async (options) => {
        const domain = config.mailgun?.subdomain ? 
          `${config.mailgun.subdomain}.${config.domainName}` : 
          config.domainName;
          
        return await client.messages.create(domain, {
          from: options.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
      }
    };
  } else {
    // Fallback to nodemailer with SMTP
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      } : undefined,
    });
  }
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Password reset token
 * @param {string} name - User's name
 */
export async function sendPasswordResetEmail(email, resetToken, name = '') {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/reset-password?token=${resetToken}`;
    
    const subject = 'Reset Your Password - SleepySquid Drones';
    const greeting = name ? `Hi ${name}` : 'Hi there';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background-color: #3b82f6; padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .button:hover { background-color: #2563eb; }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            .warning { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
            .warning strong { color: #92400e; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SleepySquid Drones</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>${greeting},</p>
              <p>We received a request to reset your password for your SleepySquid Drones account. If you made this request, click the button below to reset your password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">
                ${resetUrl}
              </p>
              
              <div class="warning">
                <strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you didn't request this password reset, you can safely ignore this email.
              </div>
              
              <p>If you continue to have problems, please contact our support team.</p>
              
              <p>Best regards,<br>The SleepySquid Drones Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}. If you didn't request this, please ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const text = `
      Hi ${name || 'there'},
      
      We received a request to reset your password for your SleepySquid Drones account.
      
      To reset your password, visit this link: ${resetUrl}
      
      This link will expire in 1 hour for your security.
      
      If you didn't request this password reset, you can safely ignore this email.
      
      Best regards,
      The SleepySquid Drones Team
    `;
    
    const mailOptions = {
      from: config.mailgun?.fromNoReply || `SleepySquid Drones <noreply@${config.domainName}>`,
      to: email,
      subject,
      html,
      text,
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', result.messageId || result.id);
    return { success: true, messageId: result.messageId || result.id };
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send email verification email
 * @param {string} email - Recipient email
 * @param {string} verificationToken - Email verification token
 * @param {string} name - User's name
 */
export async function sendEmailVerification(email, verificationToken, name = '') {
  try {
    const transporter = createTransporter();
    const verifyUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/verify-email?token=${verificationToken}`;
    
    const subject = 'Verify Your Email - SleepySquid Drones';
    const greeting = name ? `Hi ${name}` : 'Hi there';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background-color: #3b82f6; padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .button:hover { background-color: #059669; }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            .info { background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 20px 0; }
            .info strong { color: #1e40af; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SleepySquid Drones</h1>
            </div>
            <div class="content">
              <h2>Welcome to SleepySquid Drones!</h2>
              <p>${greeting},</p>
              <p>Thank you for creating an account with SleepySquid Drones. To complete your registration and start using our services, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verifyUrl}" class="button">Verify My Email</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">
                ${verifyUrl}
              </p>
              
              <div class="info">
                <strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification email.
              </div>
              
              <p>Once verified, you'll be able to:</p>
              <ul>
                <li>Access your dashboard</li>
                <li>Book drone services</li>
                <li>Manage your account settings</li>
                <li>Receive important updates</li>
              </ul>
              
              <p>If you didn't create this account, you can safely ignore this email.</p>
              
              <p>Welcome aboard!<br>The SleepySquid Drones Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}. If you didn't create this account, please ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const text = `
      Welcome to SleepySquid Drones!
      
      Hi ${name || 'there'},
      
      Thank you for creating an account with SleepySquid Drones. To complete your registration, please verify your email address by visiting this link:
      
      ${verifyUrl}
      
      This verification link will expire in 24 hours.
      
      If you didn't create this account, you can safely ignore this email.
      
      Welcome aboard!
      The SleepySquid Drones Team
    `;
    
    const mailOptions = {
      from: config.mailgun?.fromNoReply || `SleepySquid Drones <noreply@${config.domainName}>`,
      to: email,
      subject,
      html,
      text,
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Email verification sent successfully:', result.messageId || result.id);
    return { success: true, messageId: result.messageId || result.id };
    
  } catch (error) {
    console.error('Error sending email verification:', error);
    throw new Error('Failed to send email verification');
  }
}

/**
 * Send welcome email after successful verification
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
export async function sendWelcomeEmail(email, name = '') {
  try {
    const transporter = createTransporter();
    const dashboardUrl = `${process.env.NEXTAUTH_URL || `https://${config.domainName}`}/dashboard`;
    
    const subject = 'Welcome to SleepySquid Drones!';
    const greeting = name ? `Hi ${name}` : 'Hi there';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SleepySquid Drones</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background-color: #3b82f6; padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .button:hover { background-color: #2563eb; }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            .feature { background-color: #f8fafc; border-radius: 6px; padding: 15px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚁 SleepySquid Drones</h1>
            </div>
            <div class="content">
              <h2>Your account is ready!</h2>
              <p>${greeting},</p>
              <p>Congratulations! Your email has been verified and your SleepySquid Drones account is now active. You're ready to experience professional aerial photography and videography services.</p>
              
              <div style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              </div>
              
              <h3>What you can do now:</h3>
              
              <div class="feature">
                <strong>📅 Book Services</strong><br>
                Schedule aerial photography, videography, mapping, or inspection services.
              </div>
              
              <div class="feature">
                <strong>🎯 Manage Projects</strong><br>
                Track your bookings, view project status, and access completed work.
              </div>
              
              <div class="feature">
                <strong>⚙️ Customize Settings</strong><br>
                Update your profile, preferences, and notification settings.
              </div>
              
              <div class="feature">
                <strong>📞 Get Support</strong><br>
                Contact our team for questions, custom projects, or technical support.
              </div>
              
              <p>If you have any questions or need assistance getting started, don't hesitate to reach out to our support team at ${config.mailgun?.supportEmail || `support@${config.domainName}`}.</p>
              
              <p>Thank you for choosing SleepySquid Drones for your aerial service needs!</p>
              
              <p>Best regards,<br>The SleepySquid Drones Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} SleepySquid Drones. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const text = `
      Your account is ready!
      
      Hi ${name || 'there'},
      
      Congratulations! Your email has been verified and your SleepySquid Drones account is now active.
      
      Visit your dashboard: ${dashboardUrl}
      
      What you can do now:
      - Book aerial photography, videography, mapping, or inspection services
      - Track your bookings and view project status
      - Update your profile and preferences
      - Contact our support team for assistance
      
      Thank you for choosing SleepySquid Drones!
      
      Best regards,
      The SleepySquid Drones Team
    `;
    
    const mailOptions = {
      from: config.mailgun?.fromAdmin || `SleepySquid Drones <lawrence@${config.domainName}>`,
      to: email,
      subject,
      html,
      text,
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', result.messageId || result.id);
    return { success: true, messageId: result.messageId || result.id };
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email as it's not critical
    return { success: false, error: error.message };
  }
}