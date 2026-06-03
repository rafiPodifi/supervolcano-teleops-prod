import { Client } from "pg";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), ".env.local") });

const POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING;

if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL_NON_POOLING");
  process.exit(1);
}

async function checkState() {
  const client = new Client({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tasks', 'jobs', 'moments', 'moment_media', 'task_media')
      ORDER BY table_name
    `);
    console.log("📊 Tables:", tables.rows.map((r) => r.table_name).join(", "));

    // Check location_preferences columns
    const prefCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'location_preferences' 
      AND column_name IN ('moment_id', 'task_id', 'job_id')
      ORDER BY column_name
    `);
    console.log("\n📊 Location preferences columns:");
    prefCols.rows.forEach((r) => {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    });

    // Check robot_executions columns
    const execCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'robot_executions' 
      AND column_name IN ('moment_id', 'task_id')
      ORDER BY column_name
    `);
    console.log("\n📊 Robot executions columns:");
    execCols.rows.forEach((r) => {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    });
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

checkState();
