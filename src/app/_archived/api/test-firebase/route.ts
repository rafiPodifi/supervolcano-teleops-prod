/**
 * Comprehensive Firebase Admin SDK Test Endpoint
 * 
 * Tests all CRUD operations to verify Firebase Admin SDK can write to Firestore.
 * This prevents the 404 "database does not exist" errors from the old codebase.
 * 
 * URL: http://localhost:3000/api/test-firebase
 */

import { NextResponse } from "next/server";
import { adminDb, getAdminApp } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

export async function GET() {
  const results: {
    timestamp: string;
    projectId: string | undefined;
    tests: any;
    success: boolean;
    errors: string[];
    message?: string;
    errorDetails?: any;
    diagnosis?: string;
  } = {
    timestamp: new Date().toISOString(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    tests: {} as any,
    success: true,
    errors: [] as string[],
  };

  try {
    // TEST 1: Read project config
    console.log("[Test] Starting Firebase Admin SDK tests...");
    
    // Ensure adminDb is initialized
    const db = adminDb;
    const app = getAdminApp();
    
    if (!db || !app) {
      throw new Error("Firebase Admin SDK not properly initialized");
    }
    
    results.tests.config = {
      projectId: app.options.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || "unknown",
      databaseId: "(default)",
      status: "success",
    };

    // TEST 2: Create a test document
    console.log("[Test] Testing CREATE operation...");
    const testDocRef = db.collection("_firebase_test").doc("test-doc");
    const testData = {
      message: "Write test from Firebase Admin SDK",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      testId: Math.random().toString(36).substring(7),
    };

    await testDocRef.set(testData);
    results.tests.create = {
      status: "success",
      docPath: testDocRef.path,
    };
    console.log("[Test] CREATE successful");

    // TEST 3: Read the document back
    console.log("[Test] Testing READ operation...");
    const snapshot = await testDocRef.get();
    if (!snapshot.exists) {
      throw new Error("Document was created but cannot be read back");
    }
    results.tests.read = {
      status: "success",
      data: snapshot.data(),
    };
    console.log("[Test] READ successful");

    // TEST 4: Update the document
    console.log("[Test] Testing UPDATE operation...");
    await testDocRef.update({
      updated: true,
      updateTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    results.tests.update = {
      status: "success",
    };
    console.log("[Test] UPDATE successful");

    // TEST 5: Query for the document
    console.log("[Test] Testing QUERY operation...");
    const querySnapshot = await db
      .collection("_firebase_test")
      .where("message", "==", testData.message)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      throw new Error("Query returned no results");
    }
    results.tests.query = {
      status: "success",
      docsFound: querySnapshot.size,
    };
    console.log("[Test] QUERY successful");

    // TEST 6: Delete the document
    console.log("[Test] Testing DELETE operation...");
    await testDocRef.delete();

    // Verify deletion
    const deletedSnapshot = await testDocRef.get();
    if (deletedSnapshot.exists) {
      throw new Error("Document still exists after deletion");
    }
    results.tests.delete = {
      status: "success",
    };
    console.log("[Test] DELETE successful");

    // TEST 7: Batch write operations
    console.log("[Test] Testing BATCH operations...");
    const batch = db.batch();
    const batchRef1 = db.collection("_firebase_test").doc("batch-1");
    const batchRef2 = db.collection("_firebase_test").doc("batch-2");

    batch.set(batchRef1, {
      test: "batch1",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(batchRef2, {
      test: "batch2",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    results.tests.batch = {
      status: "success",
    };
    console.log("[Test] BATCH successful");

    // Cleanup batch docs
    await batchRef1.delete();
    await batchRef2.delete();

    console.log("[Test] All tests passed! ✅");
    results.message =
      "✅ All Firebase Admin SDK operations successful! Safe to proceed with building features.";

  } catch (error: any) {
    console.error("[Test] ERROR:", error);
    results.success = false;
    results.errors.push(error.message);
    results.errorDetails = {
      message: error.message,
      code: error.code,
      stack: error.stack,
      fullError: JSON.stringify(error, null, 2),
    };

    // Specific checks for common issues
    if (
      error.message?.includes("database") &&
      error.message?.includes("does not exist")
    ) {
      results.diagnosis =
        "🚨 DATABASE NOT FOUND ERROR - This is the same 404 error from old codebase. Check: 1) Project ID is correct, 2) Database exists in Firebase Console, 3) Database is in Native mode (not Datastore)";
    } else if (error.message?.includes("permission")) {
      results.diagnosis =
        "🚨 PERMISSION ERROR - Service account may not have correct permissions. Check IAM roles in Google Cloud Console.";
    } else if (error.message?.includes("timeout")) {
      results.diagnosis =
        "🚨 TIMEOUT ERROR - Connection to Firestore is timing out. Check network settings.";
    } else {
      results.diagnosis =
        "🚨 UNKNOWN ERROR - See errorDetails above for full information.";
    }

    results.message =
      "❌ Firebase Admin SDK tests FAILED. DO NOT proceed with building features until this is fixed.";
  }

  return NextResponse.json(results, {
    status: results.success ? 200 : 500,
  });
}

