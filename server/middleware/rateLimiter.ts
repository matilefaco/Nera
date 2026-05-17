import rateLimit from "express-rate-limit";

const skipHandler = (req: any) => {
  if (process.env.NODE_ENV !== 'production') return true;
  // Skip if it's an internal dashboard request (has auth header)
  if (req.headers && req.headers.authorization) return true;
  return false;
};

/**
 * Public Lookup Limiter
 * Used for /api/slug, public profile/showcase routes
 * 30 requests per minute
 */
export const publicLookupLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHandler,
  message: {
    error: "Aguarde um instante antes de tentar novamente."
  }
});

/**
 * Booking Limiter
 * Used for public booking creation and interaction
 * 10 requests per minute
 */
export const bookingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHandler,
  message: {
    error: "Aguarde um instante antes de tentar novamente."
  }
});

// Export as bookingRateLimiter for existing compatibility in bookingRoutes.ts
export const bookingRateLimiter = bookingLimiter;

/**
 * Analytics Limiter
 * Used for public analytics events
 * 20 requests per minute
 */
export const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHandler,
  message: {
    error: "Aguarde um instante antes de tentar novamente."
  }
});

export const reviewSubmitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHandler,
  message: {
    error: "Aguarde um instante antes de tentar novamente."
  }
});

export const publicReadLimiter = publicLookupLimiter;

export const authMutationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHandler,
  message: {
    error: "Aguarde um instante antes de tentar novamente."
  }
});
