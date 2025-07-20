// This script is for testing URL construction logic
// Note: This requires the build to be completed first due to ES module imports

console.log('🧪 URL Construction Test');
console.log('⚠️  This test requires ES modules support or a built application');
console.log('💡 For now, this serves as documentation of test scenarios\n');

// Mock the URL utils for testing without imports
const mockBuildVerificationUrl = (path, params = {}) => {
  const baseUrl = process.env.NEXTAUTH_URL || 
                  process.env.NEXT_PUBLIC_APP_URL || 
                  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null);
  
  if (!baseUrl) {
    throw new Error('No base URL available');
  }
  
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  
  return url.toString();
};

const mockIsValidUrl = (url) => {
  try {
    new URL(url);
    return !url.includes('undefined') && !url.includes('null');
  } catch {
    return false;
  }
};

const mockGetBaseUrl = () => {
  return mockBuildVerificationUrl('').replace(/\/$/, '');
};

const { buildVerificationUrl, isValidUrl, getBaseUrl } = {
  buildVerificationUrl: mockBuildVerificationUrl,
  isValidUrl: mockIsValidUrl,
  getBaseUrl: mockGetBaseUrl
};

// Mock different environment scenarios
const testScenarios = [
  {
    name: 'Production with NEXTAUTH_URL',
    env: {
      NEXTAUTH_URL: 'https://example.com',
      NODE_ENV: 'production'
    }
  },
  {
    name: 'Production with NEXT_PUBLIC_APP_URL fallback',
    env: {
      NEXT_PUBLIC_APP_URL: 'https://app.example.com',
      NODE_ENV: 'production'
    }
  },
  {
    name: 'Development without URL vars',
    env: {
      NODE_ENV: 'development'
    }
  },
  {
    name: 'Missing all URL environment variables',
    env: {
      NODE_ENV: 'production'
    }
  },
  {
    name: 'NEXTAUTH_URL with trailing slash',
    env: {
      NEXTAUTH_URL: 'https://example.com/',
      NODE_ENV: 'production'
    }
  }
];

console.log('🧪 Testing URL Construction for Email Verification\n');

testScenarios.forEach((scenario, index) => {
  console.log(`\n${index + 1}. ${scenario.name}`);
  console.log('   Environment:', JSON.stringify(scenario.env, null, 2));
  
  // Set environment variables
  const originalEnv = { ...process.env };
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('NEXTAUTH_URL') || key.startsWith('NEXT_PUBLIC_APP_URL') || key === 'NODE_ENV') {
      delete process.env[key];
    }
  });
  Object.assign(process.env, scenario.env);
  
  try {
    // Test base URL
    const baseUrl = getBaseUrl();
    console.log(`   Base URL: ${baseUrl}`);
    
    // Test verification URLs
    const emailVerifyUrl = buildVerificationUrl('/verify-email', { token: 'test-token-123' });
    const emailChangeUrl = buildVerificationUrl('/verify-email-change', { token: 'test-token-456' });
    
    console.log(`   Email Verify URL: ${emailVerifyUrl}`);
    console.log(`   Email Change URL: ${emailChangeUrl}`);
    
    // Validate URLs
    const emailVerifyValid = isValidUrl(emailVerifyUrl);
    const emailChangeValid = isValidUrl(emailChangeUrl);
    
    console.log(`   Email Verify Valid: ${emailVerifyValid ? '✅' : '❌'}`);
    console.log(`   Email Change Valid: ${emailChangeValid ? '✅' : '❌'}`);
    
    if (emailVerifyValid && emailChangeValid) {
      console.log('   Result: ✅ SUCCESS');
    } else {
      console.log('   Result: ❌ FAILED - Invalid URLs generated');
    }
    
  } catch (error) {
    console.log(`   Result: ❌ ERROR - ${error.message}`);
  }
  
  // Restore original environment
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('NEXTAUTH_URL') || key.startsWith('NEXT_PUBLIC_APP_URL') || key === 'NODE_ENV') {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
});

console.log('\n🏁 URL Construction Tests Complete');
console.log('\n💡 Recommendations:');
console.log('   - Always set NEXTAUTH_URL in production');
console.log('   - Use NEXT_PUBLIC_APP_URL as a fallback');
console.log('   - Ensure config.domainName is properly set');
console.log('   - Test email verification in staging environment');