#!/usr/bin/env node

// Test script to verify admin login configuration
// Run with: node scripts/test-admin-login.js

const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Admin Login Configuration\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');

console.log('📁 Environment Files:');
console.log(`   .env: ${fs.existsSync(envPath) ? '✅ Found' : '❌ Not found'}`);
console.log(`   .env.local: ${fs.existsSync(envLocalPath) ? '✅ Found' : '❌ Not found'}\n`);

// Load environment variables
require('dotenv').config();

// Test admin configuration
console.log('🔧 Environment Variables:');
console.log(`   ADMIN_EMAILS: ${process.env.ADMIN_EMAILS ? '✅ Set' : '❌ Not set'}`);
console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`   GOOGLE_ID: ${process.env.GOOGLE_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`   GOOGLE_SECRET: ${process.env.GOOGLE_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Not set'}\n`);

if (process.env.ADMIN_EMAILS) {
  const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim());
  console.log('👥 Admin Emails Configured:');
  adminEmails.forEach((email, index) => {
    console.log(`   ${index + 1}. ${email}`);
  });
  console.log(`   Total: ${adminEmails.length} admin(s)\n`);
} else {
  console.log('❌ No admin emails configured! Please set ADMIN_EMAILS in your .env file.\n');
}

// Test admin config import
try {
  // Dynamically import the admin config (requires ES modules or transpilation)
  const adminConfigPath = path.join(process.cwd(), 'libs', 'adminConfig.js');
  
  if (fs.existsSync(adminConfigPath)) {
    console.log('📋 Admin Configuration:');
    console.log('   adminConfig.js: ✅ Found');
    
    // Test with a sample email if provided
    if (process.argv[2]) {
      const testEmail = process.argv[2];
      console.log(`   Testing email: ${testEmail}`);
      
      // This would require running in a Node.js environment with proper module resolution
      console.log('   Note: Run this in your Next.js environment to test email validation');
    }
  } else {
    console.log('❌ adminConfig.js not found!');
  }
} catch (error) {
  console.log(`❌ Error testing admin config: ${error.message}`);
}

console.log('\n🚀 Next Steps:');
console.log('1. Ensure all environment variables are set in production');
console.log('2. Test admin login with a configured email address');
console.log('3. Check browser console for authentication errors');
console.log('4. Verify Google OAuth credentials are valid');

console.log('\n💡 Usage: node scripts/test-admin-login.js [email-to-test]');