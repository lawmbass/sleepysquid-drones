const crypto = require('crypto');

function generateSecureKey(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generateAdminKeys() {
  console.log('🔐 Generating Admin Dashboard API Keys\n');
  
  const adminApiKey = generateSecureKey(32);
  const nextAuthSecret = generateSecureKey(32);
  
  console.log('Add these to your .env.local file:\n');
  console.log('# Admin Dashboard Configuration');
  console.log(`ADMIN_API_KEY=${adminApiKey}`);
  console.log(`NEXT_PUBLIC_ADMIN_API_KEY=${adminApiKey}`);
  console.log(`NEXTAUTH_SECRET=${nextAuthSecret}`);
  console.log('\n# Update these with your actual values:');
  console.log('NEXT_PUBLIC_ADMIN_EMAIL=admin@yourdomain.com');
  console.log('NEXTAUTH_URL=http://localhost:3000');
  console.log('\n# Optional OAuth (Google):');
  console.log('GOOGLE_ID=your-google-oauth-client-id');
  console.log('GOOGLE_SECRET=your-google-oauth-client-secret');
  console.log('\n✅ Keys generated successfully!');
  console.log('\n⚠️  Important Security Notes:');
  console.log('- Keep these keys secret and secure');
  console.log('- Never commit them to version control');
  console.log('- Use different keys for production');
  console.log('- Regenerate keys if compromised');
}

if (require.main === module) {
  generateAdminKeys();
}

module.exports = { generateSecureKey, generateAdminKeys }; 