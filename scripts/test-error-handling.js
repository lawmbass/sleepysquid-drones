#!/usr/bin/env node

// Test script to verify authentication error handling
// Run with: node scripts/test-error-handling.js

const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Authentication Error Handling\n');

// Test the error handler API route
const testErrorHandler = () => {
  console.log('📋 Testing Error Handler Logic:');
  
  // Simulate the error handler function
  const simulateErrorHandler = (error) => {
    console.log(`   Input error: "${error}"`);
    
    // This simulates what our error handler does
    const errorMessage = encodeURIComponent(error || 'Authentication failed');
    const redirectUrl = `/admin/login?auth_error=${errorMessage}`;
    
    console.log(`   Encoded error: "${errorMessage}"`);
    console.log(`   Redirect URL: "${redirectUrl}"`);
    
    return redirectUrl;
  };
  
  // Test various error scenarios
  const testCases = [
    'Callback',
    'OAuthCallback', 
    'OAuthSignin',
    'AccessDenied',
    'Verification',
    '',
    undefined
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n   Test ${index + 1}: ${testCase || 'undefined'}`);
    const result = simulateErrorHandler(testCase);
    console.log(`   Result: ${result}`);
  });
};

// Test the login page error message translation
const testErrorMessages = () => {
  console.log('\n🔤 Testing Error Message Translation:');
  
  // This simulates the getErrorMessage function from login page
  const getErrorMessage = (errorCode) => {
    const errorMessages = {
      'Callback': 'Authentication failed. Please try again.',
      'OAuthCallback': 'Google authentication failed. Please try again.',
      'OAuthSignin': 'Unable to sign in with Google. Please try again.',
      'OAuthCreateAccount': 'Unable to create account. Please try again.',
      'EmailCreateAccount': 'Unable to create account with this email.',
      'Signin': 'Sign in failed. Please try again.',
      'OAuthAccountNotLinked': 'This email is already associated with another account.',
      'EmailSignin': 'Unable to send sign in email.',
      'CredentialsSignin': 'Invalid credentials.',
      'SessionRequired': 'Please sign in to access this page.',
      'AccessDenied': 'Access denied. You may not have permission to access this resource.',
      'Verification': 'Verification failed. Please try again.',
      'Default': 'An authentication error occurred. Please try again.'
    };
    
    return errorMessages[errorCode] || errorMessages['Default'];
  };
  
  const testCases = [
    'Callback',
    'OAuthCallback',
    'AccessDenied',
    'UnknownError',
    ''
  ];
  
  testCases.forEach((testCase, index) => {
    const message = getErrorMessage(testCase);
    console.log(`   ${testCase || 'empty'}: "${message}"`);
  });
};

// Test URL encoding/decoding
const testUrlEncoding = () => {
  console.log('\n🔗 Testing URL Encoding/Decoding:');
  
  const testCases = [
    'Callback',
    'OAuth Error',
    'Access Denied: Insufficient permissions',
    'Special chars: & < > " \''
  ];
  
  testCases.forEach((testCase, index) => {
    const encoded = encodeURIComponent(testCase);
    const decoded = decodeURIComponent(encoded);
    
    console.log(`   Original: "${testCase}"`);
    console.log(`   Encoded:  "${encoded}"`);
    console.log(`   Decoded:  "${decoded}"`);
    console.log(`   Match:    ${testCase === decoded ? '✅' : '❌'}\n`);
  });
};

// Check if the error handler file exists and has correct content
const checkErrorHandlerFile = () => {
  console.log('📁 Checking Error Handler File:');
  
  const errorHandlerPath = path.join(process.cwd(), 'pages', 'api', 'auth', 'error.js');
  
  if (fs.existsSync(errorHandlerPath)) {
    console.log('   error.js: ✅ Found');
    
    const content = fs.readFileSync(errorHandlerPath, 'utf8');
    
    // Check if it redirects to login page
    if (content.includes('/admin/login?auth_error=')) {
      console.log('   Redirect to login: ✅ Correct');
    } else if (content.includes('/?auth_error=')) {
      console.log('   Redirect to login: ❌ Redirects to home page instead');
    } else {
      console.log('   Redirect to login: ❓ Unknown redirect behavior');
    }
    
    // Check if it has proper error handling
    if (content.includes('encodeURIComponent')) {
      console.log('   URL encoding: ✅ Present');
    } else {
      console.log('   URL encoding: ❌ Missing');
    }
  } else {
    console.log('   error.js: ❌ Not found');
  }
};

// Check if login page has error handling
const checkLoginPageErrorHandling = () => {
  console.log('\n📄 Checking Login Page Error Handling:');
  
  const loginPagePath = path.join(process.cwd(), 'pages', 'admin', 'login.js');
  
  if (fs.existsSync(loginPagePath)) {
    console.log('   login.js: ✅ Found');
    
    const content = fs.readFileSync(loginPagePath, 'utf8');
    
    // Check for error handling features
    const checks = [
      { name: 'Error state', pattern: /useState.*error/i },
      { name: 'URL param check', pattern: /router\.query\.auth_error/i },
      { name: 'Error display', pattern: /error.*&&/i },
      { name: 'Error message translation', pattern: /getErrorMessage/i },
      { name: 'URL decoding', pattern: /decodeURIComponent/i }
    ];
    
    checks.forEach(check => {
      const found = check.pattern.test(content);
      console.log(`   ${check.name}: ${found ? '✅' : '❌'}`);
    });
  } else {
    console.log('   login.js: ❌ Not found');
  }
};

// Run all tests
console.log('🧪 Running Authentication Error Handling Tests\n');

testErrorHandler();
testErrorMessages();
testUrlEncoding();
checkErrorHandlerFile();
checkLoginPageErrorHandling();

console.log('\n✅ Error Handling Test Complete!');
console.log('\n🚀 To test in browser:');
console.log('1. Visit: http://localhost:3000/api/auth/error?error=Callback');
console.log('2. Should redirect to: http://localhost:3000/admin/login?auth_error=Callback');
console.log('3. Login page should show: "Authentication failed. Please try again."'); 