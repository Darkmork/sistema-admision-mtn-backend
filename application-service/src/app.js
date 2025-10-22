/**
 * Express Application
 * Main application setup with middleware and routes
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const logger = require('./utils/logger');
const { fail } = require('./utils/responseHelpers');
const SimpleCache = require('./utils/SimpleCache');

// Import routes
const applicationRoutes = require('./routes/applicationRoutes');
const documentRoutes = require('./routes/documentRoutes');
const studentRoutes = require('./routes/studentRoutes');
const { generateCsrfToken } = require('./middleware/csrfMiddleware');

const app = express();

// Initialize cache
const applicationCache = new SimpleCache({
  defaultTTL: 600000, // 10 minutes default
  maxSize: 2000,
  enableStats: true
});

logger.info('SimpleCache initialized (TTL: 10min, MaxSize: 2000)');

// Middleware
app.use(compression());

// NOTE: CORS is handled by the API Gateway, not by individual services

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach cache to request object
app.use((req, res, next) => {
  req.applicationCache = applicationCache;
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'application-service',
    status: 'healthy',
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
    logger.error('Error generating CSRF token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSRF token'
    });
  }
});

// Cache management endpoints
app.post('/api/applications/cache/clear', (req, res) => {
  try {
    const cleared = applicationCache.clear();
    logger.info(`Cache cleared: ${cleared} entries removed`);
    res.json({
      success: true,
      message: 'Application cache cleared successfully',
      entriesCleared: cleared
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

app.get('/api/applications/cache/stats', (req, res) => {
  try {
    const stats = applicationCache.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

// Routes
app.use('/api/applications', applicationRoutes);
app.use('/api/applications/documents', documentRoutes);
app.use('/api/documents', documentRoutes); // Alternative path
app.use('/api/students', studentRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json(
    fail('NOT_FOUND', `Route ${req.method} ${req.path} not found`)
  );
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(
      fail('UPLOAD_ERROR', `File too large. Maximum size: ${process.env.MAX_FILE_SIZE || '10MB'}`)
    );
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(
      fail('UPLOAD_ERROR', `Too many files. Maximum: ${process.env.MAX_FILES || '5'}`)
    );
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(
      fail('UPLOAD_ERROR', 'Unexpected file field')
    );
  }

  // Generic error
  res.status(500).json(
    fail('INTERNAL_ERROR', 'An unexpected error occurred', err.message)
  );
});

module.exports = app;
