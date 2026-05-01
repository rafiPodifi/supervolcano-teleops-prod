import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { sql } from '@/lib/db/postgres';
import { getUserClaims, requireRole } from '@/lib/utils/auth';

export const dynamic = 'force-dynamic';

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

    console.log('🧹 Cleaning up unwanted tasks from Firestore...');
    
    try {
      const tasksRef = adminDb.collection('tasks');
      const snapshot = await tasksRef.get();
      
      console.log(`📋 Found ${snapshot.size} total tasks`);
      
      let deletedCount = 0;
      const deletedTasks: Array<{id: string, title: string}> = [];
      
      // Define unwanted task patterns
      const unwantedPatterns = [
        'drone reconnaissance',
        'thermal sensor calibration',
      ];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const title = (data.title || '').toLowerCase();
        const actualTitle = data.title || '';
        
        // Check if task matches unwanted patterns
        const isUnwanted = 
          unwantedPatterns.some(pattern => title.includes(pattern)) ||
          (title === 'general' || title === '') ||
          (data.category === 'general' && !title);
        
        if (isUnwanted) {
          console.log(`Deleting task: ${doc.id} - "${actualTitle || 'unnamed'}"`);
          
          // Delete from Firestore
          await doc.ref.delete();
          
          deletedTasks.push({
            id: doc.id,
            title: actualTitle || 'unnamed',
          });
          deletedCount++;
        }
      }
      
      console.log(`✅ Deleted ${deletedCount} unwanted tasks from Firestore`);
      
      return NextResponse.json({
        success: true,
        deletedCount,
        deletedTasks,
        message: `Deleted ${deletedCount} unwanted tasks. Run sync to update SQL.`,
      });
      
    } catch (error: any) {
      console.error('❌ Failed to cleanup tasks:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }
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

