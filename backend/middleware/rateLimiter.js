const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login/register endpoints
 * Strict: 10 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  // Use default keyGenerator (req.ip) — trust proxy is already set in server.js
  validate: { xForwardedForHeader: false, default: true }
});

/**
 * General API rate limiter
 * 100 requests per 1 minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests. Please slow down and try again in a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true }
});

/**
 * Rate limiter for file uploads
 * 20 uploads per 10 minutes per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: {
    error: 'Too many file uploads. Please try again in 10 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true }
});

module.exports = {
  authLimiter,
  apiLimiter,
  uploadLimiter
};
