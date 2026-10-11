import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash a password using bcrypt
 * @param {string} password - The plain text password
 * @returns {Promise<string>} - The hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare a password with its hash
 * @param {string} password - The plain text password
 * @param {string} hash - The hashed password
 * @returns {Promise<boolean>} - Whether the password matches
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 * @param {number} length - The length of the token in bytes (default: 32)
 * @returns {string} - The generated token
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validatePassword(password) {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} - Whether the email is valid
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate password reset token with expiration
 * @param {number} expirationHours - Hours until token expires (default: 1)
 * @returns {Object} - Token and expiration date
 */
export function generatePasswordResetToken(expirationHours = 1) {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + expirationHours);
  
  return {
    token,
    expires,
    requestedAt: new Date()
  };
}

/**
 * Generate email verification token with expiration
 * @param {number} expirationHours - Hours until token expires (default: 24)
 * @returns {Object} - Token and expiration date
 */
export function generateEmailVerificationToken(expirationHours = 24) {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + expirationHours);
  
  return {
    token,
    expires
  };
}

/**
 * Check if a token has expired
 * @param {Date} expirationDate - The expiration date
 * @returns {boolean} - Whether the token has expired
 */
export function isTokenExpired(expirationDate) {
  return new Date() > new Date(expirationDate);
}

/**
 * Sanitize user input
 * @param {string} input - The input to sanitize
 * @returns {string} - The sanitized input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim();
}

/**
 * Rate limiting check for authentication attempts using database storage
 * @param {string} identifier - Email or IP address
 * @param {number} maxAttempts - Maximum attempts allowed (default: 5)
 * @param {number} windowMinutes - Time window in minutes (default: 15)
 * @returns {Object} - Rate limit status
 */
export async function checkRateLimit(identifier, maxAttempts = 5, windowMinutes = 15) {
  try {
    const { checkAuthRateLimit } = await import('./db/rateLimit');
    return await checkAuthRateLimit(identifier, maxAttempts, windowMinutes);
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the attempt if rate limiting fails
    return {
      isLimited: false,
      remainingAttempts: maxAttempts,
      resetTime: null
    };
  }
}

/**
 * Record an authentication attempt in the database
 * @param {string} identifier - Email or IP address
 */
export async function recordAuthAttempt(identifier) {
  try {
    const { recordAuthRateLimit } = await import('./db/rateLimit');
    await recordAuthRateLimit(identifier);
  } catch (error) {
    console.error('Failed to record auth attempt:', error);
    // Non-critical error - continue execution
  }
}