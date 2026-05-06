import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserClaims, requireRole } from '@/lib/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to inspect tasks in Firestore
 */
export async function GET(request: NextRequest) {
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
    
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get('locationId');
    
    console.log('🔍 DEBUG TASKS: Inspecting tasks for location:', locationId);
    
    // Get all tasks
    const allTasksSnap = await adminDb.collection('tasks').get();
    console.log('🔍 DEBUG TASKS: Total tasks in database:', allTasksSnap.size);
    
    const allTasks = allTasksSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || data.name,
        locationId: data.locationId,
        propertyId: data.propertyId,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });
    
    // Filter by location if provided
    let filteredTasks = allTasks;
    if (locationId) {
      filteredTasks = allTasks.filter(t => 
        t.locationId === locationId || t.propertyId === locationId
      );
      console.log('🔍 DEBUG TASKS: Tasks matching locationId:', filteredTasks.length);
    }
    
    // Group by locationId/propertyId
    const byLocation = new Map<string, any[]>();
    allTasks.forEach(task => {
      const locId = task.locationId || task.propertyId || 'unknown';
      if (!byLocation.has(locId)) {
        byLocation.set(locId, []);
      }
      byLocation.get(locId)!.push(task);
    });
    
    const locationGroups = Array.from(byLocation.entries()).map(([locId, tasks]) => ({
      locationId: locId,
      count: tasks.length,
      tasks: tasks.map(t => ({ id: t.id, title: t.title })),
    }));
    
    return NextResponse.json({
      success: true,
      summary: {
        totalTasks: allTasks.length,
        filteredTasks: filteredTasks.length,
        locationId: locationId || 'all',
      },
      allTasks: allTasks.slice(0, 20), // Limit to first 20
      filteredTasks,
      byLocation: locationGroups,
    });
  } catch (error: any) {
    console.error('❌ DEBUG TASKS: Failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

