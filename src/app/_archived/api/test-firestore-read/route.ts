import { NextResponse } from "next/server";
import { collection, getDocs, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseClient";

// Test if Firestore reads work
export async function GET() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: "No authenticated user" }, { status: 401 });
    }

    // Test read from locations collection
    const locationsRef = collection(db, "locations");
    const snapshot = await getDocs(locationsRef);
    const locations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      message: "Firestore read test successful",
      user: {
        uid: currentUser.uid,
        email: currentUser.email,
      },
      locationsCount: locations.length,
      locations: locations.slice(0, 3), // First 3 for debugging
      dbInfo: {
        appName: db.app.name,
        projectId: db.app.options.projectId,
        type: db.type,
      },
    });
  } catch (error) {
    console.error("Firestore read test failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

