// Admin configuration
export const adminConfig = {
  // Array of allowed admin email addresses from environment variables
  allowedEmails: (() => {
    // Get admin emails from environment variable (comma-separated)
    const envEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS;
    
    if (envEmails) {
      // Split by comma and clean up whitespace
      return envEmails.split(',').map(email => email.trim()).filter(email => email);
    }
    
    // Fallback for development - but this should be set in .env
    console.warn('⚠️  ADMIN_EMAILS not set in environment variables. No admin access will be granted.');
    console.warn('⚠️  Please set ADMIN_EMAILS in your .env file to enable admin access.');
    return []; // Return empty array - no admin access without proper env configuration
  })(),
  
  // Check if an email is authorized for admin access
  isAdmin: (email) => {
    if (!email) return false;
    return adminConfig.allowedEmails.includes(email);
  },
  
  // Get all allowed admin emails
  getAllowedEmails: () => {
    return [...adminConfig.allowedEmails];
  },
  
  // Reload admin emails from environment (for future use)
  reloadFromEnv: () => {
    const envEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS;
    if (envEmails) {
      adminConfig.allowedEmails = envEmails.split(',').map(email => email.trim()).filter(email => email);
    }
  },
  
  // Get configured emails info for debugging
  getConfigInfo: () => {
    return {
      emails: adminConfig.allowedEmails,
      source: process.env.NEXT_PUBLIC_ADMIN_EMAILS ? 'NEXT_PUBLIC_ADMIN_EMAILS' : 
              process.env.ADMIN_EMAILS ? 'ADMIN_EMAILS' : 'fallback',
      count: adminConfig.allowedEmails.length
    };
  }
};

export default adminConfig; 