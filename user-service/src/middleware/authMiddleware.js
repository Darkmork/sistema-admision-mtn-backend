/**
 * Authentication Middleware
 *
 * JWT token validation middleware with signature verification
 */

const jwt = require('jsonwebtoken');

// JWT secret from environment (must match authService.js)
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_001',
        message: 'Access token required'
      }
    });
  }

  try {
    // Verify JWT signature and decode payload
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_004',
          message: 'Token expired'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Invalid signature'
        }
      });
    }

    // Generic token validation error
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_002',
        message: 'Invalid token format'
      }
    });
  }
};

module.exports = {
  authenticateToken
};
