import config from "@/config";

/**
 * Constructs a verification URL with proper validation and fallback logic
 * @param {string} path - The path to append (e.g., '/verify-email')
 * @param {Object} params - Query parameters to append
 * @returns {string} - The complete verification URL
 */
export function buildVerificationUrl(path, params = {}) {
  // Get base URL from various sources with fallbacks
  let baseUrl = process.env.NEXTAUTH_URL;
  
  // Fallback 1: Try NEXT_PUBLIC_APP_URL (for client-side builds)
  if (!baseUrl) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Fallback 2: Use config domain (most reliable fallback)
  if (!baseUrl && config.domainName) {
    baseUrl = `https://${config.domainName}`;
  }
  
  // Fallback 3: Development fallback
  if (!baseUrl && process.env.NODE_ENV === 'development') {
    baseUrl = 'http://localhost:3000';
    console.warn('⚠️ NEXTAUTH_URL not set, using development fallback: http://localhost:3000');
  }
  
  // Final validation
  if (!baseUrl) {
    throw new Error(
      'Unable to construct verification URL: NEXTAUTH_URL environment variable is not set and no fallback URL available. ' +
      'Please set NEXTAUTH_URL in your environment variables.'
    );
  }
  
  // Ensure baseUrl doesn't end with slash
  baseUrl = baseUrl.replace(/\/$/, '');
  
  // Ensure path starts with slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Construct URL
  const url = new URL(path, baseUrl);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  
  return url.toString();
}

/**
 * Validates that a URL is properly formed
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return !url.includes('undefined') && !url.includes('null');
  } catch {
    return false;
  }
}

/**
 * Gets the base URL for the application with fallbacks
 * @returns {string} - The base URL
 */
export function getBaseUrl() {
  return buildVerificationUrl('').replace(/\/$/, '');
}