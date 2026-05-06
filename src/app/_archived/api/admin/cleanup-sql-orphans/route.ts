import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { sql } from '@/lib/db/postgres';
import { getUserClaims, requireRole } from '@/lib/utils/auth';

export const dynamic = 'force-dynamic';

// GET endpoint to preview orphaned tasks
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

    console.log('🔍 Checking for orphaned SQL tasks...');

    // Get Firestore task IDs
    const firestoreSnapshot = await adminDb.collection('tasks').get();
    const firestoreTaskIds = new Set(firestoreSnapshot.docs.map(doc => doc.id));
    
    console.log(`Firestore has ${firestoreTaskIds.size} tasks`);

    // Get SQL task IDs
    const sqlTasksResult = await sql`SELECT id, title FROM jobs`;
    const sqlTasks = Array.isArray(sqlTasksResult) 
      ? sqlTasksResult 
      : (sqlTasksResult as any)?.rows || [];
    
    console.log(`SQL has ${sqlTasks.length} tasks`);

    // Find orphaned tasks (in SQL but not in Firestore)
    const orphanedTasks = sqlTasks.filter((t: any) => !firestoreTaskIds.has(t.id));
    
    console.log(`Found ${orphanedTasks.length} orphaned tasks`);

    return NextResponse.json({
      success: true,
      firestoreCount: firestoreTaskIds.size,
      sqlCount: sqlTasks.length,
      orphanedCount: orphanedTasks.length,
      orphanedTasks: orphanedTasks.map((t: any) => ({
        id: t.id,
        title: t.title || 'unnamed',
      })),
    });
    
  } catch (error: any) {
    console.error('❌ Preview failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint to delete orphaned tasks
export async function POST(request: Request) {
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

    console.log('🧹 Cleaning up orphaned SQL tasks...');
    
    // Step 1: Get all task IDs from Firestore (source of truth)
    console.log('Step 1: Getting task IDs from Firestore...');
    const firestoreSnapshot = await adminDb.collection('tasks').get();
    const firestoreTaskIds = new Set(firestoreSnapshot.docs.map(doc => doc.id));
    
    console.log(`Firestore has ${firestoreTaskIds.size} tasks`);
    
    // Step 2: Get all task IDs from SQL
    console.log('Step 2: Getting task IDs from SQL...');
    const sqlTasksResult = await sql`SELECT id, title FROM jobs`;
    const sqlTasks = Array.isArray(sqlTasksResult)
      ? sqlTasksResult
      : (sqlTasksResult as any)?.rows || [];
    
    console.log(`SQL has ${sqlTasks.length} tasks`);
    
    // Step 3: Find orphaned tasks (in SQL but not in Firestore)
    console.log('Step 3: Finding orphaned tasks...');
    const orphanedTasks = sqlTasks.filter((t: any) => !firestoreTaskIds.has(t.id));
    
    console.log(`Found ${orphanedTasks.length} orphaned tasks in SQL`);
    orphanedTasks.forEach((t: any) => {
      console.log(`  - ${t.id}: "${t.title || 'unnamed'}"`);
    });
    
    if (orphanedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned tasks found',
        deleted: 0,
      });
    }
    
    // Step 4: Delete orphaned tasks from SQL
    console.log('Step 4: Deleting orphaned tasks from SQL...');
    let deletedCount = 0;
    const deletedTasks: Array<{id: string, title: string}> = [];
    
    for (const task of orphanedTasks) {
      console.log(`Deleting orphaned task: ${task.id} - "${task.title || 'unnamed'}"`);
      
      try {
        // Delete media first
        await sql`DELETE FROM media WHERE job_id = ${task.id}`;
        console.log(`  Deleted media for task ${task.id}`);
        
        // Delete job
        await sql`DELETE FROM jobs WHERE id = ${task.id}`;
        console.log(`  Deleted job ${task.id}`);
        
        // Verify deletion
        const verifyResult = await sql`SELECT id FROM jobs WHERE id = ${task.id}`;
        const verify = Array.isArray(verifyResult) 
          ? verifyResult 
          : (verifyResult as any)?.rows || [];
        
        if (verify.length === 0) {
          console.log(`  ✅ Successfully deleted: ${task.title || 'unnamed'}`);
          deletedTasks.push({ id: task.id, title: task.title || 'unnamed' });
          deletedCount++;
        } else {
          console.error(`  ❌ Failed to delete: ${task.title || 'unnamed'}`);
        }
      } catch (deleteError: any) {
        console.error(`  ❌ Error deleting ${task.id}:`, deleteError.message);
      }
    }
    
    console.log(`✅ Cleanup complete! Deleted ${deletedCount} orphaned tasks`);
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} orphaned tasks from SQL`,
      deleted: deletedCount,
      deletedTasks,
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}



