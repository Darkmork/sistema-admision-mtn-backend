const app = require('./app');
const { dbPool } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8086;

let server;

const startServer = async () => {
  try {
    // Test database connection
    /*const client = await dbPool.connect();
    logger.info('Database connection established successfully');
    client.release();*/

    // Start HTTP server
    // Railway: Must listen on 0.0.0.0 to be accessible via Private Networking
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Dashboard Service running on port ${PORT}`);
      logger.info(`Listening on 0.0.0.0:${PORT} (accessible via private network)`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Cache enabled: ${process.env.CACHE_ENABLED !== 'false'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await dbPool.end();
        logger.info('Database connections closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

startServer();
