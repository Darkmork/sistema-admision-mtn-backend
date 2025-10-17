require('dotenv').config();
const express = require('express');
const compression = require('compression');
const logger = require('./utils/logger');
const { fail } = require('./utils/responseHelpers');

// Import routes
const evaluationRoutes = require('./routes/evaluationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');

const app = express();

// Middleware
app.use(compression());
// Note: CORS is handled by NGINX Gateway, not by individual services

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
    service: 'evaluation-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/interviews', interviewRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json(fail('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json(fail('INTERNAL_ERROR', 'An unexpected error occurred', err.message));
});

module.exports = app;
