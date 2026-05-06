/**
 * INITIALIZE POSTGRESQL SCHEMA
 * Creates tables for robot intelligence sync
 * RUN ONCE AFTER DEPLOYMENT
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { Client } from 'pg';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let client: Client | null = null;

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - superadmin only' }, { status: 403 });
    }

    client = new Client({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DATABASE,
      port: 5432,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    // Create robot_intelligence table
    await client.query(`
      CREATE TABLE IF NOT EXISTS robot_intelligence (
        id SERIAL PRIMARY KEY,
        firebase_id VARCHAR(255) UNIQUE NOT NULL,
        synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
        task_id VARCHAR(255),
        location_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        organization_id VARCHAR(255) NOT NULL,
        completion_time INTEGER,
        accuracy DECIMAL(5,2),
        errors INTEGER DEFAULT 0,
        video_url TEXT,
        thumbnail_url TEXT,
        annotations JSONB,
        file_size BIGINT,
        duration INTEGER,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_organization ON robot_intelligence(organization_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_location ON robot_intelligence(location_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_created_at ON robot_intelligence(created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_updated_at ON robot_intelligence(updated_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task ON robot_intelligence(task_id)');

    // Create api_keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_hash VARCHAR(255) UNIQUE NOT NULL,
        key_prefix VARCHAR(10) NOT NULL,
        organization_id VARCHAR(255) NOT NULL,
        organization_name VARCHAR(255) NOT NULL,
        permissions JSONB DEFAULT '{"read": true}'::jsonb,
        rate_limit_per_hour INTEGER DEFAULT 1000,
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_key_hash ON api_keys(key_hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)');

    // Create api_usage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_usage (
        id SERIAL PRIMARY KEY,
        organization_id VARCHAR(255) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_api_usage_org ON api_usage(organization_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at)');

    return NextResponse.json({
      success: true,
      message: 'PostgreSQL schema initialized successfully',
      tables: ['robot_intelligence', 'api_keys', 'api_usage'],
    });
  } catch (error: any) {
    console.error('[Init SQL Schema] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}

