const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { dbPool } = require('../config/database');
const { fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

/**
 * Authenticate middleware - Validates JWT token and checks active session
 * This ensures tokens can be invalidated server-side when users log in from different devices
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(fail('AUTH_001', 'Token no proporcionado'));
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.error('JWT verification failed:', error.message);
      return res.status(401).json(fail('AUTH_002', 'Token inválido o expirado'));
    }

    // Hash the token to check against active_sessions
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Check if session is active in database
    const client = await dbPool.connect();
    try {
      const sessionQuery = await client.query(
        'SELECT id, user_id, last_activity FROM active_sessions WHERE token_hash = $1',
        [tokenHash]
      );

      if (sessionQuery.rows.length === 0) {
        // Session was invalidated (user logged in from another device/tab)
        logger.warn(`Session not found for user ${decoded.userId}`);
        return res.status(401).json(fail('SESSION_INVALIDATED', 'Sesión inválida. Por favor, inicia sesión nuevamente.'));
      }

      // Update last_activity timestamp
      await client.query(
        'UPDATE active_sessions SET last_activity = NOW() WHERE token_hash = $1',
        [tokenHash]
      );

      // Attach user data to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };

      logger.debug('User authenticated successfully:', req.user);
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json(fail('AUTH_003', 'Error de autenticación'));
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(fail('AUTH_001', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.userId} with role ${req.user.role}`);
      return res.status(403).json(fail('AUTH_005', `Access denied. Required roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
