/**
 * Server Entry Point
 * Starts the Express server and handles graceful shutdown
 */

const app = require('./app');
const { createDatabasePool, testConnection, closePool } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8083;
const SERVICE_NAME = process.env.SERVICE_NAME || 'application-service';

let server;
let dbPool;

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Initialize database pool
    dbPool = createDatabasePool();

    // Test database connection
    const dbConnected = await testConnection(dbPool);
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start HTTP server
    // Railway: Must listen on :: (IPv6) to be accessible via Private Networking
    server = app.listen(PORT, '::', () => {
      logger.info(`${SERVICE_NAME} started successfully`);
      logger.info(`Listening on [::]:${PORT} (IPv6 - accessible via Railway private network)`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Database connection pooling enabled`);
      logger.info(`Circuit breakers enabled (Simple, Medium, Write)`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        if (dbPool) {
          await closePool(dbPool);
          logger.info('Database connections closed');
        }
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();
