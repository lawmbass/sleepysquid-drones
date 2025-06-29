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
  max: 5, // limit each IP to 5 booking requests per 15 minutes
  message: {
    error: 'Too many booking attempts',
    message: 'Too many booking requests. Please wait before trying again.'
  }
});

export const adminRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // limit admin requests to 50 per 5 minutes
  message: {
    error: 'Too many admin requests',
    message: 'Too many admin requests. Please wait before trying again.'
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