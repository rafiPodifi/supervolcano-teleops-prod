import { NextResponse } from 'next/server';
import { migratePropertyIdToLocationId } from '@/lib/scripts/migratePropertyIdToLocationId';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * API endpoint to migrate propertyId to locationId
 * Visit: /api/admin/migrate-location-ids
 */
export async function POST(request: Request) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Missing token' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (decodedToken.role !== 'admin' && decodedToken.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log('Starting migration via API...');
    
    const result = await migratePropertyIdToLocationId();
    
    return NextResponse.json({
      success: true,
      message: 'Migration complete',
      ...result
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Send POST request to run migration',
    endpoint: '/api/admin/migrate-location-ids',
    note: 'This will add locationId field to all tasks that currently use propertyId',
    auth: 'Requires admin authentication via Bearer token'
  });
}

