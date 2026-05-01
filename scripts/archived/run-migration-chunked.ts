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

    // Read migration script
    const migrationPath = join(process.cwd(), 'database', 'migration_jobs_tasks.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute in chunks
    // Remove comments and empty lines
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.startsWith('SELECT') || s.includes('information_schema')); // Skip verification queries

    console.log(`📝 Executing ${statements.length} statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length < 10) continue; // Skip very short statements
      
      try {
        // Skip BEGIN/COMMIT - we'll handle transactions manually
        if (stmt.toUpperCase().trim() === 'BEGIN' || stmt.toUpperCase().trim() === 'COMMIT') {
          if (stmt.toUpperCase().trim() === 'BEGIN') {
            await client.query('BEGIN');
            console.log('🔄 Started transaction');
          } else {
            await client.query('COMMIT');
            console.log('✅ Committed transaction\n');
          }
          continue;
        }

        // Execute statement
        await client.query(stmt);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (error: any) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        console.error(`Statement: ${stmt.substring(0, 100)}...`);
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    
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
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'location_preferences' 
      AND column_name IN ('job_id', 'task_id', 'moment_id')
      ORDER BY column_name
    `);
    
    console.log('📊 Location preferences columns:', prefColumns.rows.map(r => r.column_name).join(', '));

    console.log('\n✅ Migration verification complete!');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    try {
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back transaction');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected');
  }
}

runMigration();

