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