// Wrap everything in try-catch to catch import errors
try {
  console.log('🔵 [INIT] Loading modules...');

  const app = require('./app');
  console.log('✅ [INIT] App loaded');

  const { dbPool } = require('./config/database');
  console.log('✅ [INIT] Database config loaded');

  const logger = require('./utils/logger');
  console.log('✅ [INIT] Logger loaded');

const PORT = process.env.PORT || 8085;
console.log(`✅ [INIT] Port configured: ${PORT}`);

let server;

const startServer = async () => {
  try {
    logger.info('🚀 Starting Notification Service...');
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📧 Email Mode: ${process.env.EMAIL_MOCK_MODE === 'true' ? 'MOCK' : 'PRODUCTION'}`);
    logger.info(`📱 SMS Mode: ${process.env.SMS_MOCK_MODE === 'true' ? 'MOCK' : 'PRODUCTION'}`);

    // Test database connection
    /*const client = await dbPool.connect();
    logger.info('Database connection established successfully');
    client.release();*/

    logger.info(`🌐 Starting HTTP server on 0.0.0.0:${PORT}...`);

    // Start HTTP server (listen on 0.0.0.0 for Railway Private Networking)
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Notification Service running on port ${PORT}`);
      logger.info(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
    });

    server.on('error', (error) => {
      logger.error('❌ Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
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

} catch (error) {
  console.error('❌ [INIT] Fatal error loading modules:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
