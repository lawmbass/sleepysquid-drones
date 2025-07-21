import rateLimit from 'express-rate-limit';

// Create different rate limiters for different endpoints
export const createRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };

  return rateLimit(defaultOptions);
};

// Specific rate limiters for different use cases
export const bookingRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // increased from 3 to 10 booking requests per 15 minutes for better user experience
  message: {
    error: 'Too many booking attempts',
    message: 'Too many booking requests. Please wait 15 minutes before trying again.'
  },
  // Skip rate limiting for successful requests to prevent blocking legitimate users
  skipSuccessfulRequests: true,
  // Only count failed requests towards the limit
  skipFailedRequests: false,
  // Use a more secure key generator that includes user agent
  keyGenerator: (req) => {
    return req.ip + ':' + (req.headers['user-agent'] || 'unknown');
  }
});

export const adminRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // limit admin requests to 100 per 5 minutes (increased for admin functionality)
  message: {
    error: 'Too many admin requests',
    message: 'Too many admin requests. Please wait 5 minutes before trying again.'
  },
  // Skip rate limiting for successful requests
  skipSuccessfulRequests: true,
  // More lenient for admin users but still protected
  keyGenerator: (req) => {
    return req.ip + ':admin';
  }
});

export const generalApiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // general API limit
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many API requests. Please try again later.'
  }
});

// Middleware wrapper for Next.js API routes
export const withRateLimit = (handler, rateLimiter = generalApiRateLimit) => {
  return async (req, res) => {
    return new Promise((resolve, reject) => {
      rateLimiter(req, res, (result) => {
        if (result instanceof Error) {
          return res.status(429).json(result.message);
        }
        return handler(req, res);
      });
    });
  };
}; 