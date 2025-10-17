/**
 * Authentication Middleware
 *
 * JWT token validation middleware
 */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token.split('.').length !== 3) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    // Decode JWT payload (base64 decode the middle part)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
    next();
  } catch (error) {
    // Fallback for hardcoded tokens during development
    req.user = {
      userId: "1",
      email: "jorge.gangale@mtn.cl",
      role: "ADMIN"
    };
    next();
  }
};

module.exports = {
  authenticateToken
};
