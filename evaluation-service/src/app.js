require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const logger = require('./utils/logger');
const { fail } = require('./utils/responseHelpers');
const SimpleCache = require('./utils/SimpleCache');

// Import routes
const evaluationRoutes = require('./routes/evaluationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const interviewerScheduleRoutes = require('./routes/interviewerScheduleRoutes');
const { generateCsrfToken } = require('./middleware/csrfMiddleware');

const app = express();

// Initialize cache
const evaluationCache = new SimpleCache({
  defaultTTL: 300000, // 5 minutos por defecto
  maxSize: 1500,
  enableStats: true
});

logger.info('✅ SimpleCache inicializado (TTL: 5min, MaxSize: 1500)');

// Middleware
app.use(compression());

// NOTE: CORS is handled by the API Gateway, not by individual services

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach cache to request object
app.use((req, res, next) => {
  req.evaluationCache = evaluationCache;
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
    service: 'evaluation-service',
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
app.post('/api/evaluations/cache/clear', (req, res) => {
  try {
    const cleared = evaluationCache.clear();
    logger.info(`Caché limpiado: ${cleared} entradas eliminadas`);
    res.json({
      success: true,
      message: 'Caché de evaluaciones limpiado exitosamente',
      entriesCleared: cleared
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar caché'
    });
  }
});

app.get('/api/evaluations/cache/stats', (req, res) => {
  try {
    const stats = evaluationCache.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas del caché'
    });
  }
});

// Temporary endpoint to fix database schema
app.post('/api/fix-schema-interviewer-schedules', async (req, res) => {
  try {
    const { dbPool } = require('./config/database');

    // Make date column nullable
    await dbPool.query('ALTER TABLE interviewer_schedules ALTER COLUMN date DROP NOT NULL;');
    logger.info('✅ date column is now nullable');

    // Make user_id column nullable
    await dbPool.query('ALTER TABLE interviewer_schedules ALTER COLUMN user_id DROP NOT NULL;');
    logger.info('✅ user_id column is now nullable');

    // Verify changes
    const result = await dbPool.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'interviewer_schedules'
        AND column_name IN ('date', 'user_id')
      ORDER BY column_name;
    `);

    res.json({
      success: true,
      message: 'Schema fixed successfully',
      columns: result.rows
    });
  } catch (error) {
    logger.error('Error fixing schema:', error);
    res.status(500).json({
      success: false,
      error: 'Error fixing schema',
      details: error.message
    });
  }
});

// Routes
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/interviewer-schedules', interviewerScheduleRoutes);

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
