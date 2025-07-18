// Cache for allowed emails to prevent console spam
let cachedAllowedEmails = null;
let hasLoggedWarning = false;

// Get allowed emails from environment variable with caching
const getAllowedEmails = () => {
  // Return cached result if available
  if (cachedAllowedEmails !== null) {
    return cachedAllowedEmails;
  }
  
    // SECURITY: Only use server-side environment variable (no NEXT_PUBLIC_)
    const envEmails = process.env.ADMIN_EMAILS;
    
    if (envEmails) {
      // Split by comma and clean up whitespace
    cachedAllowedEmails = envEmails.split(',').map(email => email.trim()).filter(email => email);
    return cachedAllowedEmails;
    }
    
  // Only log warning once to prevent console spam
  if (!hasLoggedWarning) {
    console.warn('⚠️  ADMIN_EMAILS not set in environment variables. No admin access will be granted.');
    console.warn('⚠️  Please set ADMIN_EMAILS in your .env file to enable admin access.');
    hasLoggedWarning = true;
  }
  
  cachedAllowedEmails = []; // Cache empty array
  return cachedAllowedEmails;
};

// Admin configuration
export const adminConfig = {
  // Get all allowed admin emails (uses cached version)
  get allowedEmails() {
    return getAllowedEmails();
  },
  
  // Check if an email is authorized for admin access
  isAdmin: (email) => {
    if (!email) return false;
    
    // Only allow sleepysquid emails to be admins
    const isSleepySquidEmail = email.toLowerCase().endsWith('@sleepysquid.com');
    if (!isSleepySquidEmail) return false;
    
    return getAllowedEmails().includes(email);
  },
  
  // Get all allowed admin emails
  getAllowedEmails: () => {
    return [...getAllowedEmails()];
  },
  
  // Reload admin emails from environment (clears cache)
  reloadFromEnv: () => {
    // Clear cache to force reload
    cachedAllowedEmails = null;
    hasLoggedWarning = false;
    
    // Get fresh data
    const emails = getAllowedEmails();
    console.log(`Admin emails reloaded from environment: ${emails.length} email(s) configured`);
    return emails;
  },
  
  // Get configured emails info for debugging (server-side only)
  getConfigInfo: () => {
    const allowedEmails = getAllowedEmails();
    return {
      count: allowedEmails.length,
      source: process.env.ADMIN_EMAILS ? 'ADMIN_EMAILS' : 'fallback',
      // SECURITY: Don't expose actual email addresses in debug info
      hasEmails: allowedEmails.length > 0,
      cached: cachedAllowedEmails !== null
    };
  }
};

export default adminConfig; 