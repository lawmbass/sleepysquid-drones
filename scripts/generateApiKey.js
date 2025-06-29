const crypto = require('crypto');

/**
 * Generate a secure API key
 * @param {number} length - Length of the key (default: 32)
 * @param {string} prefix - Prefix for the key (default: 'sk_api_')
 * @returns {string} - Generated API key
 */
function generateApiKey(length = 32, prefix = 'sk_api_') {
  const randomBytes = crypto.randomBytes(length);
  const key = randomBytes.toString('hex');
  return `${prefix}${key}`;
}

/**
 * Generate a secure webhook secret
 * @returns {string} - Generated webhook secret
 */
function generateWebhookSecret() {
  return generateApiKey(32, 'whsec_');
}

// If script is run directly, generate keys
if (require.main === module) {
  console.log('🔐 Security Key Generator');
  console.log('========================');
  console.log();
  console.log('General API Key:');
  console.log(generateApiKey());
  console.log();
  console.log('Webhook Secret:');
  console.log(generateWebhookSecret());
  console.log();
  console.log('💡 Add these to your .env file if needed:');
  console.log(`API_KEY=${generateApiKey()}`);
  console.log(`WEBHOOK_SECRET=${generateWebhookSecret()}`);
  console.log();
  console.log('ℹ️  Note: Admin authentication uses session-based auth (NextAuth.js)');
  console.log('   Use scripts/generateAdminKey.js for admin configuration.');
}

module.exports = {
  generateApiKey,
  generateWebhookSecret
}; 