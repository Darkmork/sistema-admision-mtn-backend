/**
 * Authentication Middleware
 * Mock JWT authentication for development/testing
 */

const { fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

/**
 * Mock JWT authentication middleware
 * Decodes base64-encoded JWT payload without verification
 * Accepts token from Authorization header OR query parameter (for file downloads)
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;

    // Try to get token from header first, then from query parameter
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (queryToken) {
      // Allow token in query parameter for file downloads via window.open()
      token = queryToken;
    } else {
      return res.status(401).json(
        fail('AUTH_001', 'No authorization token provided')
      );
    }

    // Mock JWT decoding (development only)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json(
        fail('AUTH_002', 'Invalid token format')
      );
    }

    // Decode payload (base64)
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return res.status(401).json(
        fail('AUTH_003', 'Token has expired')
      );
    }

    // Attach user to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };

    logger.debug('User authenticated:', req.user);
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json(
      fail('AUTH_004', 'Invalid or malformed token')
    );
  }
};

/**
 * Role-based authorization middleware
 * @param {Array<string>} allowedRoles - Array of allowed roles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        fail('AUTH_001', 'Authentication required')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.userId} with role ${req.user.role}`);
      return res.status(403).json(
        fail('AUTH_005', `Access denied. Required roles: ${allowedRoles.join(', ')}`)
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};
