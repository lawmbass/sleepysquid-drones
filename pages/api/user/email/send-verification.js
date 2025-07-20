import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { sendEmail } from "@/libs/mailgun";
import config from "@/config";
import crypto from "crypto";

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

    // Connect to database
    await connectMongo();

    // Get user from database
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return res.status(400).json({ 
        message: 'Email is already verified',
        isVerified: true
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with verification token
    await User.findByIdAndUpdate(user._id, {
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });

    // Create verification link
    const verificationLink = `${process.env.NEXTAUTH_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationLink);

    res.status(200).json({
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function sendVerificationEmail(email, name, verificationLink) {
  const subject = 'Verify Your Email Address';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email Address</h1>
        </div>
        
        <p>Hi ${name || 'there'},</p>
        
        <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
          <a href="${verificationLink}" class="button">Verify Email Address</a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #3b82f6;">${verificationLink}</p>
        
        <p>This verification link will expire in 24 hours.</p>
        
        <div class="footer">
          <p>If you didn't create an account with us, you can safely ignore this email.</p>
          <p>Questions? Contact us at <a href="mailto:${config.mailgun.supportEmail}">${config.mailgun.supportEmail}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Hi ${name || 'there'},
    
    Thank you for signing up! Please verify your email address by visiting this link:
    
    ${verificationLink}
    
    This verification link will expire in 24 hours.
    
    If you didn't create an account with us, you can safely ignore this email.
    
    Questions? Contact us at ${config.mailgun.supportEmail}
  `;

  await sendEmail({
    to: email,
    subject,
    html,
    text,
    replyTo: config.mailgun.supportEmail
  });
}