const { Pool } = require('pg');
const logger = require('../utils/logger');

const dbPool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000'),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000')
  })
  : new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'Admisión_MTN_DB',
    user: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000'),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000')
  });

dbPool.on('connect', () => logger.info('New database connection established'));
dbPool.on('error', (err) => logger.error('Unexpected database pool error:', err));
dbPool.on('remove', () => logger.info('Database connection removed from pool'));

const testConnection = async () => {
  try {
    const client = await dbPool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
};

const closePool = async () => {
  try {
    await dbPool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
    throw error;
  }
};

module.exports = { dbPool, testConnection, closePool };
