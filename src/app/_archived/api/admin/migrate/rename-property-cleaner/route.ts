/**
 * MIGRATION: Rename property_cleaner → location_cleaner
 * ONE-TIME USE - DELETE AFTER RUNNING
 */
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    console.log('🚀 Starting property_cleaner → location_cleaner migration...');
    const stats = {
      usersAnalyzed: 0,
      usersUpdated: 0,
      authUpdated: 0,
      errors: [] as string[],
    };

    // Find all users with property_cleaner role
    const usersSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'location_cleaner')
      .get();

    stats.usersAnalyzed = usersSnapshot.size;
    console.log(`Found ${usersSnapshot.size} users with property_cleaner role`);

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // Update Firestore
        await adminDb.collection('users').doc(userDoc.id).update({
          role: 'location_cleaner',
          updated_at: new Date(),
        });
        stats.usersUpdated++;

        // Update Auth custom claims
        try {
          const user = await adminAuth.getUser(userDoc.id);
          const currentClaims = user.customClaims || {};
          await adminAuth.setCustomUserClaims(userDoc.id, {
            ...currentClaims,
            role: 'location_cleaner',
          });
          stats.authUpdated++;
        } catch (authError: any) {
          console.error(`Auth update failed for ${userDoc.id}:`, authError.message);
          stats.errors.push(`Auth: ${userDoc.id} - ${authError.message}`);
        }

        console.log(`✅ Updated ${userData.email}`);
      } catch (error: any) {
        console.error(`Failed to update ${userDoc.id}:`, error.message);
        stats.errors.push(`${userDoc.id}: ${error.message}`);
      }
    }

    console.log('✅ Migration complete!');
    return NextResponse.json({
      success: true,
      message: 'property_cleaner renamed to location_cleaner',
      stats,
    });
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

