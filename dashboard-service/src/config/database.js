const { Pool } = require('pg');
const logger = require('../utils/logger');

// Priority-based database configuration
// 1st priority: DATABASE_URL (for production/Railway/Heroku)
// 2nd priority: Individual DB_* environment variables

const dbConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000', 10)
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'Admisión_MTN_DB',
    user: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000', 10)
  };

const dbPool = new Pool(dbConfig);

// Connection event handlers
dbPool.on('connect', () => {
  logger.info('New database connection established');
});

dbPool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

dbPool.on('remove', () => {
  logger.debug('Database connection removed from pool');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connections...');
  await dbPool.end();
});

module.exports = { dbPool };
