/**
 * Database Migration Runner
 * Runs SQL migrations in the migrations/ directory
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database configuration - uses DATABASE_URL from Railway or local config
const dbPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('railway')
        ? { rejectUnauthorized: false }
        : false
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'Admisión_MTN_DB',
      user: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin123'
    });

async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    // Get all SQL files in migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Alphabetical order ensures 001, 002, 003...

    console.log(`📂 Found ${files.length} migration file(s)`);

    for (const file of files) {
      console.log(`\n  ▶️  Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await dbPool.query(sql);
      console.log(`  ✅ Migration completed: ${file}`);
    }

    console.log('\n✨ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

runMigrations();
