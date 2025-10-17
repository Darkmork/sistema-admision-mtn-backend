const { fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(fail('AUTH_001', 'No authorization token provided'));
    }
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json(fail('AUTH_002', 'Invalid token format'));
    }
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return res.status(401).json(fail('AUTH_003', 'Token has expired'));
    }
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
    logger.debug('User authenticated:', req.user);
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json(fail('AUTH_004', 'Invalid or malformed token'));
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
