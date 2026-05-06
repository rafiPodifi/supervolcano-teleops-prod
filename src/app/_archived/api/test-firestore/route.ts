import { NextRequest, NextResponse } from "next/server";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/**
 * Test endpoint to verify Firestore writes work
 * POST /api/test-firestore
 */
export async function POST(request: NextRequest) {
  try {
    const testId = `test-${Date.now()}`;
    const testRef = doc(db, "locations", testId);
    
    const testData = {
      name: "Test Location",
      partnerOrgId: "demo-org",
      address: "Test Address",
      description: "Test description",
      images: [],
      media: [],
      imageCount: 0,
      videoCount: 0,
      status: "unassigned",
      isActive: true,
      taskCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log("[test-firestore] Attempting to write test document...", {
      id: testId,
      path: testRef.path,
      projectId: db.app.options.projectId,
    });

    await setDoc(testRef, testData);

    console.log("[test-firestore] Test document written successfully", testId);

    return NextResponse.json({
      success: true,
      message: "Firestore write test succeeded",
      documentId: testId,
    });
  } catch (error: any) {
    console.error("[test-firestore] Test failed", {
      error: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
