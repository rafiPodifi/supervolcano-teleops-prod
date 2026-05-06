import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING;

if (!POSTGRES_URL) {
  console.error('❌ Missing POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    // Read the fixed migration script
    const migrationPath = join(process.cwd(), 'database', 'migration_jobs_tasks_fixed.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration script...');
    console.log('⚠️  This will rename tables: tasks → jobs, moments → tasks\n');
    
    // Execute the migration
    await client.query(migrationSql);

    console.log('✅ Migration completed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('jobs', 'tasks', 'task_media')
      ORDER BY table_name
    `);
    
    console.log('📊 Tables found:', tablesCheck.rows.map(r => r.table_name).join(', '));

    const tasksColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      AND column_name IN ('job_id', 'task_id')
      ORDER BY column_name
    `);
    
    console.log('📊 Tasks table columns:', tasksColumns.rows.map(r => r.column_name).join(', '));

    const prefColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'location_preferences' 
      AND column_name IN ('job_id', 'task_id', 'moment_id')
      ORDER BY column_name
    `);
    
    console.log('📊 Location preferences columns:');
    prefColumns.rows.forEach(r => {
      console.log(`   - ${r.column_name}: ${r.data_type}`);
    });

    const execColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'robot_executions' 
      AND column_name IN ('task_id', 'moment_id')
      ORDER BY column_name
    `);
    
    console.log('📊 Robot executions columns:', execColumns.rows.map(r => r.column_name).join(', '));

    console.log('\n✅ Migration verification complete!');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected');
  }
}

runMigration();

