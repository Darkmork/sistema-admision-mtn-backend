require('dotenv').config();
const express = require('express');
const path = require('path');
const { createDatabasePool } = require('./config/database');
const { createCircuitBreakers } = require('./config/circuitBreaker');
const { generateCsrfToken } = require('./middleware/csrfMiddleware');
const SimpleCache = require(path.join(__dirname, '../../shared/utils/SimpleCache'));
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const debugRoutes = require('./routes/debugRoutes');

const app = express();
const port = process.env.PORT || 8082;

// Initialize database pool
const dbPool = createDatabasePool();

// Initialize circuit breakers
const { simpleQueryBreaker, mediumQueryBreaker, writeOperationBreaker} = createCircuitBreakers();

// Initialize cache
const userCache = new SimpleCache({
  defaultTTL: 600000, // 10 minutes default
  maxSize: 2000,
  enableStats: true
});

console.log('✅ SimpleCache initialized (TTL: 10min, MaxSize: 2000)');

// Middleware
// NOTE: CORS is handled by the API Gateway, not by individual services

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
    port: port,
    timestamp: new Date().toISOString()
  });
});

// CSRF token endpoint (public)
app.get('/api/csrf-token', (req, res) => {
  try {
    const token = generateCsrfToken();
    res.json({
      success: true,
      csrfToken: token,
      expiresIn: 3600 // 1 hour in seconds
    });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSRF token'
    });
  }
});

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

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
// En Railway, escuchar en 0.0.0.0 permite conexiones desde otros servicios en la red privada
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ User Service running on port ${port}`);
  console.log(`✅ Listening on 0.0.0.0:${port} (accessible via private network)`);
  console.log('✅ Database connection pooling enabled');
  console.log('✅ Circuit breakers enabled (Simple, Medium, Write)');
});

module.exports = app;
