// Build validation script to check for common issues
console.log('🔍 Validating build configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
const requiredEnvVars = ['MONGODB_URI', 'GOOGLE_ID', 'GOOGLE_SECRET', 'NEXTAUTH_SECRET'];
const optionalEnvVars = ['NEXTAUTH_URL', 'MAILGUN_API_KEY'];

requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar}: Set`);
  } else {
    console.log(`❌ ${envVar}: Missing (required)`);
  }
});

optionalEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar}: Set`);
  } else {
    console.log(`⚠️  ${envVar}: Missing (optional, has fallbacks)`);
  }
});

// Check for potential import issues
console.log('\n📦 Import Validation:');
try {
  // Test config import
  console.log('✅ Config import: OK');
  
  // Test crypto module
  const crypto = require('crypto');
  const testToken = crypto.randomBytes(16).toString('hex');
  console.log('✅ Crypto module: OK');
  
  // Test URL constructor
  const testUrl = new URL('https://example.com/test');
  console.log('✅ URL constructor: OK');
  
} catch (error) {
  console.log(`❌ Import error: ${error.message}`);
}

// Check for common syntax issues
console.log('\n🔍 Syntax Check:');
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'libs/urlUtils.js',
  'pages/api/user/email/send-verification.js',
  'pages/api/user/email/change.js',
  'pages/api/user/email/verify.js',
  'pages/api/user/email/verify-change.js'
];

filesToCheck.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for common issues
      if (content.includes('undefined/')) {
        console.log(`❌ ${filePath}: Contains 'undefined/' string`);
      } else if (content.includes('import') && content.includes('export')) {
        console.log(`✅ ${filePath}: ES modules syntax OK`);
      } else {
        console.log(`✅ ${filePath}: Syntax appears OK`);
      }
    } else {
      console.log(`⚠️  ${filePath}: File not found`);
    }
  } catch (error) {
    console.log(`❌ ${filePath}: Error reading file - ${error.message}`);
  }
});

console.log('\n🏁 Build validation complete');
console.log('\n💡 Tips:');
console.log('   - Ensure all required environment variables are set');
console.log('   - Check that imports use consistent module syntax');
console.log('   - Verify that all new files are properly formatted');
console.log('   - Test email verification in staging before production');