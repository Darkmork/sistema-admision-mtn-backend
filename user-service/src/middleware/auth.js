const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

/**
 * Authenticate middleware - Validates JWT token and checks active session
 * @param {Object} dbPool - Database pool connection
 */
function authenticate(dbPool) {
  return async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Token no proporcionado'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer '

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Token inválido o expirado'
        });
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
          return res.status(401).json({
            success: false,
            error: 'Sesión inválida. Por favor, inicia sesión nuevamente.',
            code: 'SESSION_INVALIDATED'
          });
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

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error de autenticación'
      });
    }
  };
}

/**
 * Require specific roles middleware
 * @param {Array<string>} allowedRoles - Array of allowed roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
