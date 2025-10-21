const crypto = require('crypto');

/**
 * CSRF Middleware
 * Stateless CSRF protection using HMAC signatures
 */

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
const CSRF_TOKEN_EXPIRY = 3600; // 1 hour in seconds

/**
 * Generate a CSRF token
 * Format: timestamp.signature
 */
function generateCsrfToken() {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}`;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(payload)
    .digest('hex');

  return `${timestamp}.${signature}`;
}

/**
 * Verify a CSRF token
 */
function verifyCsrfToken(token) {
  if (!token) {
    return { valid: false, error: 'Token missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token format' };
  }

  const [timestamp, signature] = parts;
  const now = Math.floor(Date.now() / 1000);

  // Check expiry
  if (now - parseInt(timestamp) > CSRF_TOKEN_EXPIRY) {
    return { valid: false, error: 'Token expired' };
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(timestamp)
    .digest('hex');

  if (signature !== expectedSignature) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Middleware to validate CSRF token on POST/PUT/DELETE requests
 */
function validateCsrf(req, res, next) {
  // Skip CSRF validation for GET requests
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.headers['csrf-token'];

  const result = verifyCsrfToken(csrfToken);

  if (!result.valid) {
    return res.status(403).json({
      success: false,
      error: `CSRF validation failed: ${result.error}`,
      code: 'CSRF_VALIDATION_FAILED'
    });
  }

  next();
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  validateCsrf
};
