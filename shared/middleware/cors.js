/**
 * Shared CORS Configuration
 * Provides CORS configuration for frontend during development
 */

/**
 * Returns CORS configuration object
 * In production, this should be handled by NGINX Gateway
 * In development, we need to allow direct access from frontend
 *
 * Usage: const cors = require('cors'); app.use(cors(getCorsConfig()));
 */
function getCorsConfig() {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    process.env.FRONTEND_URL
  ].filter(Boolean); // Remove undefined values

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(null, false); // Block the request
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // 10 minutes
  };
}

module.exports = {
  getCorsConfig
};
