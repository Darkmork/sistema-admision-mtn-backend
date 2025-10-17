/**
 * Express Application
 * Main application setup with middleware and routes
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const logger = require('./utils/logger');
const { fail } = require('./utils/responseHelpers');

// Import routes
const applicationRoutes = require('./routes/applicationRoutes');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

// Middleware
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Routes
app.use('/api/applications', applicationRoutes);
app.use('/api/applications/documents', documentRoutes);
app.use('/api/documents', documentRoutes); // Alternative path

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
