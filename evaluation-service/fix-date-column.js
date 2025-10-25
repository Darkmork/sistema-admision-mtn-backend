// Temporary script to fix interviewer_schedules table schema
// Run this once via: railway run --service evaluation-service node fix-date-column.js

const { Pool } = require('pg');

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixDateColumn() {
  try {
    console.log('🔧 Fixing interviewer_schedules table schema...');

    // Make date column nullable
    await dbPool.query('ALTER TABLE interviewer_schedules ALTER COLUMN date DROP NOT NULL;');
    console.log('✅ date column is now nullable');

    // Make user_id column nullable
    await dbPool.query('ALTER TABLE interviewer_schedules ALTER COLUMN user_id DROP NOT NULL;');
    console.log('✅ user_id column is now nullable');

    // Verify changes
    const result = await dbPool.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'interviewer_schedules'
        AND column_name IN ('date', 'user_id')
      ORDER BY column_name;
    `);

    console.log('\n📋 Current schema for nullable columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log('\n✅ Schema fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  }
}

fixDateColumn();
