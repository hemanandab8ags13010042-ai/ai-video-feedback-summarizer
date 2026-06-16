/**
 * Centralized JWT configuration.
 * 
 * Security: JWT_SECRET MUST be set via environment variable in production.
 * In development mode, a random secret is generated per-session, meaning
 * tokens will NOT persist across server restarts (by design for dev safety).
 */
const crypto = require('crypto');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set in production! Exiting.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const devSecret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  WARNING: JWT_SECRET not set. Using a random dev-only secret. Tokens will NOT persist across server restarts.');
  return devSecret;
})();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN
};
