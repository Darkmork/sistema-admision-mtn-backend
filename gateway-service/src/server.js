const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint for this management server
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'gateway-management',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nginxPort: process.env.NGINX_PORT || 8080
    }
  });
});

// Gateway status proxy endpoint
app.get('/api/gateway/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`http://localhost:${process.env.NGINX_PORT || 8080}/gateway/status`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching gateway status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GATEWAY_ERROR',
        message: 'Failed to fetch gateway status',
        details: error.message
      }
    });
  }
});

// Services health check endpoint
app.get('/api/services/health', async (req, res) => {
  try {
    const axios = require('axios');
    const services = [
      { name: 'User Service', url: `${process.env.USER_SERVICE_URL}/health` },
      { name: 'Application Service', url: `${process.env.APPLICATION_SERVICE_URL}/health` },
      { name: 'Evaluation Service', url: `${process.env.EVALUATION_SERVICE_URL}/health` },
      { name: 'Notification Service', url: `${process.env.NOTIFICATION_SERVICE_URL}/health` },
      { name: 'Dashboard Service', url: `${process.env.DASHBOARD_SERVICE_URL}/health` },
      { name: 'Guardian Service', url: `${process.env.GUARDIAN_SERVICE_URL}/health` }
    ];

    const results = await Promise.all(
      services.map(async (service) => {
        try {
          const startTime = Date.now();
          const response = await axios.get(service.url, { timeout: 5000 });
          const responseTime = Date.now() - startTime;

          return {
            name: service.name,
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            data: response.data
          };
        } catch (error) {
          return {
            name: service.name,
            status: 'unhealthy',
            error: error.message
          };
        }
      })
    );

    const healthy = results.filter(r => r.status === 'healthy').length;
    const total = results.length;

    res.json({
      success: true,
      data: {
        summary: {
          healthy,
          unhealthy: total - healthy,
          total
        },
        services: results
      }
    });
  } catch (error) {
    logger.error('Error checking services health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to check services health',
        details: error.message
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Gateway Management Server running on port ${PORT}`);
  logger.info(`NGINX Gateway should be running on port ${process.env.NGINX_PORT || 8080}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
