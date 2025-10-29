const { Pool } = require('pg');

/**
 * Database Configuration
 *
 * Priority-based connection strategy:
 * 1. PRIORITY 1: Use DATABASE_URL if available (Railway production)
 * 2. PRIORITY 2: Use individual env vars (local development)
 */

const createDatabasePool = () => {
  const dbPool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: false, // Railway internal network doesn't need SSL
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        query_timeout: 5000
      })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'Admisión_MTN_DB',
        user: process.env.DB_USERNAME || 'admin',
        password: process.env.DB_PASSWORD || 'admin123',
        ssl: false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        query_timeout: 5000
      });

  console.log(`[DB] Using ${process.env.DATABASE_URL ? 'Railway DATABASE_URL' : 'local environment variables'}`);
  console.log('[DB] Connection pooling enabled: max 20 connections');

  // Pool event handlers
  dbPool.on('connect', () => {
    console.log('[DB] New database connection established');
  });

  dbPool.on('error', (err) => {
    console.error('[DB] Unexpected database pool error:', err);
  });

  dbPool.on('remove', () => {
    console.log('[DB] Database connection removed from pool');
  });

  return dbPool;
};

// Test database connection
const testConnection = async (dbPool) => {
  try {
    const client = await dbPool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('[DB] Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('[DB] Database connection test failed:', error);
    return false;
  }
};

// Graceful shutdown
const closePool = async (dbPool) => {
  try {
    await dbPool.end();
    console.log('[DB] Database pool closed successfully');
  } catch (error) {
    console.error('[DB] Error closing database pool:', error);
    throw error;
  }
};

module.exports = {
  createDatabasePool,
  testConnection,
  closePool
};
