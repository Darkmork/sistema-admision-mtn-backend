require('dotenv').config();
const express = require('express');
const { createDatabasePool } = require('./config/database');
const { createCircuitBreakers } = require('./config/circuitBreaker');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const port = process.env.PORT || 8082;

// Initialize database pool
const dbPool = createDatabasePool();

// Initialize circuit breakers
const { simpleQueryBreaker, mediumQueryBreaker, writeOperationBreaker } = createCircuitBreakers();

// Middleware
// Note: CORS is handled by NGINX Gateway, not by individual services
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach database and breakers to request object
app.use((req, res, next) => {
  req.dbPool = dbPool;
  req.circuitBreakers = {
    simple: simpleQueryBreaker,
    medium: mediumQueryBreaker,
    write: writeOperationBreaker
  };
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'user-service',
    port: port,
    timestamp: new Date().toISOString()
  });
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
app.listen(port, () => {
  console.log(`✅ User Service running on port ${port}`);
  console.log('✅ Database connection pooling enabled');
  console.log('✅ Circuit breakers enabled (Simple, Medium, Write)');
});

module.exports = app;
