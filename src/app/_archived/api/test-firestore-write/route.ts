import { NextResponse } from "next/server";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseClient";

// Test if Firestore writes work (using SDK directly)
export async function POST() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: "No authenticated user" }, { status: 401 });
    }

    // Get fresh token
    const token = await currentUser.getIdToken(true);
    
    // Decode token to check claims
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Test write to a test collection
    const testDocRef = doc(db, "test_writes", `test-${Date.now()}`);
    await setDoc(testDocRef, {
      message: "Test write from API route",
      timestamp: serverTimestamp(),
      createdBy: currentUser.uid,
      email: currentUser.email,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Firestore write test successful",
      documentId: testDocRef.id,
      documentPath: testDocRef.path,
      user: {
        uid: currentUser.uid,
        email: currentUser.email,
      },
      tokenClaims: {
        role: payload.role,
        partner_org_id: payload.partner_org_id,
      },
      dbInfo: {
        appName: db.app.name,
        projectId: db.app.options.projectId,
        type: db.type,
        databaseId: (db as any)._databaseId?._databaseId || "(default)",
      },
    });
  } catch (error) {
    console.error("Firestore write test failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorDetails: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

