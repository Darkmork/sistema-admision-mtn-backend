/**
 * Server Entry Point
 * Starts the Express server and handles graceful shutdown
 */

const app = require('./app');
const { createDatabasePool, testConnection, closePool } = require('./config/database');

const PORT = process.env.PORT || 8082;
const SERVICE_NAME = process.env.SERVICE_NAME || 'user-service';

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
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start HTTP server
    // Railway: Must listen on :: (IPv6) to be accessible via Private Networking
    server = app.listen(PORT, '::', () => {
      console.log(`✅ ${SERVICE_NAME} started successfully`);
      console.log(`✅ Listening on [::]:${PORT} (IPv6 - accessible via Railway private network)`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
      console.log('✅ Database connection pooling enabled');
      console.log('✅ Circuit breakers enabled (Simple, Medium, Write)');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');

      try {
        if (dbPool) {
          await closePool(dbPool);
          console.log('Database connections closed');
        }
        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forcing shutdown after timeout');
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
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();

