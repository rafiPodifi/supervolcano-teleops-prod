/**
 * Test Connection API Route
 * Verifies Firebase connection and returns diagnostic information
 */

import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    firebase: {
      connected: false,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "not-set",
      databaseId: process.env.FIREBASE_ADMIN_DATABASE_ID || "default",
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? "set" : "not-set",
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? "set" : "not-set",
    },
    tests: {
      firestoreRead: { success: false, error: null },
      firestoreWrite: { success: false, error: null },
      authList: { success: false, error: null },
    },
    collections: {
      partners: { exists: false, count: 0, error: null },
      teleoperators: { exists: false, count: 0, error: null },
      users: { exists: false, count: 0, error: null },
    },
  };

  try {
    // Test 1: Read from Firestore (partners collection)
    try {
      console.log("[test-connection] Testing Firestore read...");
      const partnersSnapshot = await adminDb.collection("partners").limit(1).get();
      diagnostics.tests.firestoreRead.success = true;
      diagnostics.collections.partners.exists = true;
      diagnostics.collections.partners.count = partnersSnapshot.size;
      console.log("[test-connection] ✅ Firestore read successful");
    } catch (error: any) {
      diagnostics.tests.firestoreRead.error = {
        code: error.code,
        message: error.message,
        stack: error.stack,
      };
      console.error("[test-connection] ❌ Firestore read failed:", error);
    }

    // Test 2: Write to Firestore (test document)
    try {
      console.log("[test-connection] Testing Firestore write...");
      const testRef = adminDb.collection("diagnostics").doc("connection-test");
      await testRef.set({
        timestamp: new Date().toISOString(),
        test: true,
      });
      diagnostics.tests.firestoreWrite.success = true;
      console.log("[test-connection] ✅ Firestore write successful");
      
      // Clean up test document
      await testRef.delete();
    } catch (error: any) {
      diagnostics.tests.firestoreWrite.error = {
        code: error.code,
        message: error.message,
        stack: error.stack,
      };
      console.error("[test-connection] ❌ Firestore write failed:", error);
    }

    // Test 3: List collections
    try {
      console.log("[test-connection] Testing collection access...");
      
      // Check partners
      try {
        const partnersSnapshot = await adminDb.collection("partners").get();
        diagnostics.collections.partners.exists = true;
        diagnostics.collections.partners.count = partnersSnapshot.size;
      } catch (error: any) {
        diagnostics.collections.partners.error = error.message;
      }

      // Check teleoperators
      try {
        const teleoperatorsSnapshot = await adminDb.collection("teleoperators").get();
        diagnostics.collections.teleoperators.exists = true;
        diagnostics.collections.teleoperators.count = teleoperatorsSnapshot.size;
      } catch (error: any) {
        diagnostics.collections.teleoperators.error = error.message;
      }

      // Check users
      try {
        const usersSnapshot = await adminDb.collection("users").get();
        diagnostics.collections.users.exists = true;
        diagnostics.collections.users.count = usersSnapshot.size;
      } catch (error: any) {
        diagnostics.collections.users.error = error.message;
      }

      console.log("[test-connection] ✅ Collection access successful");
    } catch (error: any) {
      console.error("[test-connection] ❌ Collection access failed:", error);
    }

    // Test 4: List users (Auth)
    try {
      console.log("[test-connection] Testing Auth list users...");
      const listUsersResult = await adminAuth.listUsers(1);
      diagnostics.tests.authList.success = true;
      diagnostics.tests.authList.userCount = listUsersResult.users.length;
      console.log("[test-connection] ✅ Auth list users successful");
    } catch (error: any) {
      diagnostics.tests.authList.error = {
        code: error.code,
        message: error.message,
        stack: error.stack,
      };
      console.error("[test-connection] ❌ Auth list users failed:", error);
    }

    // Overall connection status
    diagnostics.firebase.connected =
      diagnostics.tests.firestoreRead.success && diagnostics.tests.firestoreWrite.success;

    return NextResponse.json(diagnostics, {
      status: diagnostics.firebase.connected ? 200 : 500,
    });
  } catch (error: any) {
    console.error("[test-connection] Fatal error:", error);
    diagnostics.error = {
      message: error.message,
      stack: error.stack,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}

