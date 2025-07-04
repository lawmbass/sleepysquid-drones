// Debug route to check environment variables (without exposing secrets)
export default function handler(req, res) {
  // Only allow in development or with a debug key
  if (process.env.NODE_ENV === 'production' && req.query.debug !== 'check123') {
    return res.status(404).json({ error: 'Not found' });
  }

  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? '✅ Set' : '❌ Missing',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing',
    GOOGLE_ID: process.env.GOOGLE_ID ? '✅ Set' : '❌ Missing',
    GOOGLE_SECRET: process.env.GOOGLE_SECRET ? '✅ Set' : '❌ Missing',
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ? '✅ Set' : '❌ Missing',
    MONGODB_URI: process.env.MONGODB_URI ? '✅ Set' : '❌ Missing',
    
    // Show partial values for verification (without exposing full secrets)
    NEXTAUTH_URL_VALUE: process.env.NEXTAUTH_URL,
    GOOGLE_ID_PREFIX: process.env.GOOGLE_ID ? process.env.GOOGLE_ID.substring(0, 20) + '...' : 'N/A',
    ADMIN_EMAILS_VALUE: process.env.ADMIN_EMAILS,
  };

  res.status(200).json(envCheck);
} 