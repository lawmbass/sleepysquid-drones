// Get allowed emails from environment variable
const getAllowedEmails = () => {
  // SECURITY: Only use server-side environment variable (no NEXT_PUBLIC_)
  const envEmails = process.env.ADMIN_EMAILS;
  
  if (envEmails) {
    // Split by comma and clean up whitespace
    return envEmails.split(',').map(email => email.trim()).filter(email => email);
  }
  
  // Fallback for development - but this should be set in .env
  console.warn('⚠️  ADMIN_EMAILS not set in environment variables. No admin access will be granted.');
  console.warn('⚠️  Please set ADMIN_EMAILS in your .env file to enable admin access.');
  return []; // Return empty array - no admin access without proper env configuration
};

// Admin configuration
export const adminConfig = {
  // Array of allowed admin email addresses from SERVER-SIDE environment variables only
  allowedEmails: getAllowedEmails(),
  
  // Check if an email is authorized for admin access
  isAdmin: (email) => {
    if (!email) return false;
    const allowedEmails = getAllowedEmails(); // Always get fresh list
    return allowedEmails.includes(email);
  },
  
  // Get all allowed admin emails
  getAllowedEmails: () => {
    return [...getAllowedEmails()];
  },
  
  // Reload admin emails from environment (for future use)
  reloadFromEnv: () => {
    // SECURITY: Only use server-side environment variable
    const envEmails = process.env.ADMIN_EMAILS;
    if (envEmails) {
      // This method now just logs the reload attempt since we always get fresh data
      console.log('Admin emails reloaded from environment');
    }
  },
  
  // Get configured emails info for debugging (server-side only)
  getConfigInfo: () => {
    const allowedEmails = getAllowedEmails();
    return {
      count: allowedEmails.length,
      source: process.env.ADMIN_EMAILS ? 'ADMIN_EMAILS' : 'fallback',
      // SECURITY: Don't expose actual email addresses in debug info
      hasEmails: allowedEmails.length > 0
    };
  }
};

export default adminConfig; 