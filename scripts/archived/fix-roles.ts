/**
 * ROLE FIX SCRIPT
 * Automatically fixes role inconsistencies
 * Run: npx tsx scripts/fix-roles.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import * as readline from 'readline';

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function fixRoles() {
  const { adminAuth, adminDb } = await import("../src/lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  
  console.log('🔧 Starting Role Fix Script...\n');
  console.log('⚠️  WARNING: This will modify Firebase data!\n');
  
  const confirm = await askQuestion('Continue? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Aborted.');
    return;
  }
  
  console.log('');
  
  const fixes = {
    authClaimsSet: 0,
    firestoreUpdated: 0,
    errors: 0,
  };
  
  try {
    // Get all users
    const authUsers = await adminAuth.listUsers(1000);
    
    for (const authUser of authUsers.users) {
      const { uid, email } = authUser;
      const authRole = authUser.customClaims?.role as string | undefined;
      
      // Get Firestore document
      const firestoreDoc = await adminDb.collection('users').doc(uid).get();
      const firestoreData = firestoreDoc.data();
      const firestoreRole = firestoreData?.role as string | undefined;
      
      try {
        // Fix 1: Firestore has role but Auth doesn't
        if (firestoreRole && !authRole) {
          console.log(`🔧 Setting Auth custom claim for ${email}`);
          await adminAuth.setCustomUserClaims(uid, {
            ...authUser.customClaims,
            role: firestoreRole,
          });
          fixes.authClaimsSet++;
        }
        
        // Fix 2: Auth has role but Firestore doesn't
        if (authRole && (!firestoreDoc.exists || !firestoreRole)) {
          console.log(`🔧 Updating Firestore role for ${email}`);
          
          const updates: any = {
            role: authRole,
            updated_at: FieldValue.serverTimestamp(),
          };
          
          // Ensure required fields for field_operator
          if (authRole === 'field_operator') {
            if (!firestoreData?.displayName && !firestoreData?.name) {
              updates.displayName = email?.split('@')[0] || 'Unknown User';
            }
            if (!firestoreData?.organizationId) {
              updates.organizationId = '9a5f4710-9b1a-457c-b734-c3aed71a860a';
            }
            if (!firestoreData?.partnerId) {
              updates.partnerId = 'demo-org';
            }
          }
          
          if (firestoreDoc.exists) {
            await adminDb.collection('users').doc(uid).update(updates);
          } else {
            await adminDb.collection('users').doc(uid).set({
              email: email || '',
              ...updates,
              created_at: FieldValue.serverTimestamp(),
            });
          }
          fixes.firestoreUpdated++;
        }
        
        // Fix 3: Roles don't match - prefer Auth as source of truth
        if (authRole && firestoreRole && authRole !== firestoreRole) {
          console.log(`🔧 Syncing role mismatch for ${email} (${firestoreRole} → ${authRole})`);
          await adminDb.collection('users').doc(uid).update({
            role: authRole,
            updated_at: FieldValue.serverTimestamp(),
          });
          fixes.firestoreUpdated++;
        }
        
        // Fix 4: Specific test cleaner fixes
        if (email === 'cleaner@test.com' || email === 'testcleaner@supervolcano.com') {
          console.log('🎯 Fixing TEST CLEANER...');
          
          const updates: any = {};
          let needsUpdate = false;
          
          if (!authRole) {
            console.log('   - Setting Auth custom claim: field_operator');
            await adminAuth.setCustomUserClaims(uid, {
              ...authUser.customClaims,
              role: 'field_operator',
            });
            fixes.authClaimsSet++;
          }
          
          if (!firestoreRole || firestoreRole !== 'field_operator') {
            updates.role = 'field_operator';
            needsUpdate = true;
          }
          
          if (!firestoreData?.displayName && !firestoreData?.name) {
            updates.displayName = 'Test Cleaner';
            needsUpdate = true;
          }
          
          // Rename 'name' to 'displayName' if needed
          if (firestoreData?.name && !firestoreData?.displayName) {
            updates.displayName = firestoreData.name;
            needsUpdate = true;
          }
          
          if (!firestoreData?.organizationId) {
            updates.organizationId = '9a5f4710-9b1a-457c-b734-c3aed71a860a';
            needsUpdate = true;
          }
          
          if (!firestoreData?.partnerId) {
            updates.partnerId = 'demo-org';
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            updates.updated_at = FieldValue.serverTimestamp();
            
            if (firestoreDoc.exists) {
              await adminDb.collection('users').doc(uid).update(updates);
            } else {
              await adminDb.collection('users').doc(uid).set({
                email: email || 'cleaner@test.com',
                ...updates,
                created_at: FieldValue.serverTimestamp(),
              });
            }
            fixes.firestoreUpdated++;
            console.log('   - Updated Firestore document');
          }
          
          console.log('   ✅ Test Cleaner fixed!');
        }
        
      } catch (error: any) {
        console.error(`❌ Error fixing ${email}:`, error.message);
        fixes.errors++;
      }
    }
    
    // Summary
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ FIX COMPLETE\n');
    console.log(`Auth custom claims set: ${fixes.authClaimsSet}`);
    console.log(`Firestore documents updated: ${fixes.firestoreUpdated}`);
    console.log(`Errors: ${fixes.errors}\n`);
    
    if (fixes.errors === 0) {
      console.log('🎉 All roles fixed successfully!\n');
      console.log('Next steps:');
      console.log('1. Refresh your web portal');
      console.log('2. Open assignment modal');
      console.log('3. Test cleaner should now appear\n');
    }
    
  } catch (error: any) {
    console.error('Fatal error:', error.message);
  }
}

fixRoles();

