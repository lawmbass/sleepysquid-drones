import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { sendEmail } from "@/libs/mailgun";
import config from "@/config";
import crypto from "crypto";
import { buildVerificationUrl, isValidUrl } from "@/libs/urlUtils";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get user session
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({ message: 'New email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Connect to database
    await connectMongo();

    // Get user from database
    // Select pendingEmail to check if there's already a pending change
    const user = await User.findOne({ email: session.user.email })
      .select('+pendingEmail +pendingEmailExpires');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if there's already a pending email change that hasn't expired
    if (user.pendingEmail && user.pendingEmailExpires && user.pendingEmailExpires > new Date()) {
      return res.status(400).json({ 
        message: `You already have a pending email change to ${user.pendingEmail}. Please verify that email or wait for it to expire before requesting a new change.` 
      });
    }

    // Check if new email is the same as current email
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({ message: 'New email must be different from current email' });
    }

    // Check if new email already exists
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'This email is already in use' });
    }

    // Generate verification token for new email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with pending email change
    await User.findByIdAndUpdate(user._id, {
      pendingEmail: newEmail.toLowerCase(),
      pendingEmailToken: verificationToken,
      pendingEmailExpires: verificationExpires
    });

    // Create verification link with proper validation
    const verificationLink = buildVerificationUrl('/verify-email-change', { token: verificationToken });
    
    // Validate the constructed URL
    if (!isValidUrl(verificationLink)) {
      throw new Error('Failed to construct valid verification URL');
    }
    
    // Log the verification link in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email change verification link generated:', verificationLink);
    }

    // Send verification email to new email address
    await sendEmailChangeVerification(newEmail, user.name, verificationLink, user.email);

    res.status(200).json({
      message: 'Verification email sent to new email address'
    });

  } catch (error) {
    console.error('Email change error:', error);
    
    // Provide specific error messages for URL construction issues
    if (error.message.includes('verification URL')) {
      return res.status(500).json({ 
        message: 'Email change verification is temporarily unavailable. Please contact support.',
        error: process.env.NODE_ENV === 'development' ? error.message : 'URL configuration error'
      });
    }
    
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function sendEmailChangeVerification(newEmail, name, verificationLink, currentEmail) {
  const subject = 'Verify Your New Email Address';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Email Change</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #3b82f6; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 14px; color: #666; }
        .warning { background-color: #fef3cd; border: 1px solid #faebcc; border-radius: 4px; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your New Email Address</h1>
        </div>
        
        <p>Hi ${name || 'there'},</p>
        
        <p>You've requested to change your email address from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.</p>
        
        <p>To complete this change, please verify your new email address by clicking the button below:</p>
        
        <div style="text-align: center;">
          <a href="${verificationLink}" class="button">Verify New Email Address</a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #3b82f6;">${verificationLink}</p>
        
        <div class="warning">
          <strong>Important:</strong> This verification link will expire in 24 hours. Once verified, your login email will be changed to this new address.
        </div>
        
        <div class="footer">
          <p>If you didn't request this email change, please ignore this email and contact our support team immediately.</p>
          <p>Questions? Contact us at <a href="mailto:${config.mailgun.supportEmail}">${config.mailgun.supportEmail}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Hi ${name || 'there'},
    
    You've requested to change your email address from ${currentEmail} to ${newEmail}.
    
    To complete this change, please verify your new email address by visiting this link:
    
    ${verificationLink}
    
    This verification link will expire in 24 hours. Once verified, your login email will be changed to this new address.
    
    If you didn't request this email change, please ignore this email and contact our support team immediately.
    
    Questions? Contact us at ${config.mailgun.supportEmail}
  `;

  await sendEmail({
    to: newEmail,
    subject,
    html,
    text,
    replyTo: config.mailgun.supportEmail
  });
}