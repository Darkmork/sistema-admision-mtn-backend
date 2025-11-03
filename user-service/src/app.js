/**
 * Express Application
 * Main application setup with middleware and routes
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createDatabasePool } = require('./config/database');
const { createCircuitBreakers } = require('./config/circuitBreaker');
const { generateCsrfToken } = require('./middleware/csrfMiddleware');
const SimpleCache = require('./utils/SimpleCache');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const debugRoutes = require('./routes/debugRoutes');

const app = express();

let dbPool;
let simpleQueryBreaker, mediumQueryBreaker, writeOperationBreaker;
let userCache;

// Initialize database pool (will be passed to routes)
const initializeApp = () => {
  // Initialize database pool
  dbPool = createDatabasePool();

  // Initialize circuit breakers
  const breakers = createCircuitBreakers();
  simpleQueryBreaker = breakers.simpleQueryBreaker;
  mediumQueryBreaker = breakers.mediumQueryBreaker;
  writeOperationBreaker = breakers.writeOperationBreaker;

  // Initialize cache
  userCache = new SimpleCache({
    defaultTTL: 600000, // 10 minutes default
    maxSize: 2000,
    enableStats: true
  });

  console.log('✅ SimpleCache initialized (TTL: 10min, MaxSize: 2000)');
};

// Call initialization immediately for backward compatibility
// But allow it to be overridden by server.js
initializeApp();

// CORS configuration - Required because Railway gateway redirects instead of proxying
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://admision-mtn-front.vercel.app',
  process.env.CORS_ORIGIN || process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token'],
  exposedHeaders: ['x-request-id']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach database, breakers, and cache to request object
app.use((req, res, next) => {
  req.dbPool = dbPool;
  req.circuitBreakers = {
    simple: simpleQueryBreaker,
    medium: mediumQueryBreaker,
    write: writeOperationBreaker
  };
  req.userCache = userCache;
  next();
});

// Mount debug routes only in development or when explicitly enabled
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_ROUTES === 'true') {
  app.use('/internal', debugRoutes);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

// CSRF token endpoint removed - now only available at /api/auth/csrf-token via authRoutes.js

// Cache management endpoints
app.post('/api/users/cache/clear', (req, res) => {
  try {
    const cleared = userCache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      entriesCleared: cleared
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

app.get('/api/users/cache/stats', (req, res) => {
  try {
    const stats = userCache.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;

