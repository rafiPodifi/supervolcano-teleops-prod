import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/postgres';
import { getUserClaims, requireRole } from '@/lib/utils/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  console.log('🔧 Setting up Robot Intelligence database tables...');
  
  try {
    // Admin auth check
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    requireRole(claims, ['superadmin', 'admin']);

    // Test connection first
    console.log('Testing database connection...');
    try {
      await sql`SELECT NOW()`;
      console.log('✅ Database connected');
    } catch (dbError: any) {
      console.error('❌ Database connection failed:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: `Database connection failed: ${dbError.message}`,
        },
        { status: 500 }
      );
    }

    // Drop existing tables to recreate without foreign keys
    console.log('Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS media CASCADE`;
    await sql`DROP TABLE IF EXISTS jobs CASCADE`;
    await sql`DROP TABLE IF EXISTS locations CASCADE`;
    console.log('✅ Tables dropped');

    // Create locations table
    console.log('Creating locations table...');
    await sql`
      CREATE TABLE IF NOT EXISTS locations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        partner_org_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Locations table ready');

    // Create jobs table WITHOUT foreign key constraints
    console.log('Creating jobs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(50),
        location_id VARCHAR(255),
        location_name VARCHAR(255),
        location_address TEXT,
        estimated_duration_minutes INTEGER,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Jobs table ready (no foreign keys)');

    // Create media table WITHOUT foreign key constraints
    console.log('Creating media table...');
    await sql`
      CREATE TABLE IF NOT EXISTS media (
        id VARCHAR(255) PRIMARY KEY,
        job_id VARCHAR(255),
        location_id VARCHAR(255),
        storage_url TEXT NOT NULL,
        thumbnail_url TEXT,
        file_type VARCHAR(100),
        duration_seconds INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by VARCHAR(255)
      )
    `;
    console.log('✅ Media table ready (no foreign keys)');

    // Create indexes for performance
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_media_job ON media(job_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_media_location ON media(location_id)`;
    console.log('✅ Indexes ready');

    // Verify tables exist
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('locations', 'jobs', 'media')
    `;
    
    // Handle Vercel Postgres result (can be array or object with rows property)
    const tablesArray = Array.isArray(tablesResult) 
      ? tablesResult 
      : (tablesResult as any)?.rows || [];
    
    const tableNames = tablesArray.map((row: any) => row.table_name);
    
    console.log('✅ Database setup complete!');
    console.log('Tables found:', tableNames);

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully (without foreign key constraints)',
      tables: tableNames,
    });

  } catch (error: any) {
    console.error('❌ Database setup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Admin auth check
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    requireRole(claims, ['superadmin', 'admin']);

    // Check if tables exist
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('locations', 'jobs', 'media')
    `;

    // Handle Vercel Postgres result (can be array or object with rows property)
    const tablesArray = Array.isArray(tablesResult) 
      ? tablesResult 
      : (tablesResult as any)?.rows || [];
    
    const tableNames = tablesArray.map((row: any) => row.table_name);

    return NextResponse.json({
      success: true,
      tables: tableNames,
      allTablesExist: tableNames.length === 3,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

