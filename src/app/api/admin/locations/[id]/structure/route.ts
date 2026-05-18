/**
 * LOCATION STRUCTURE API
 * Save/update location floor/room/target/action hierarchy
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * GET - Load existing structure for a location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error("[LoadStructure] Token verification failed:", err);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const uid = decodedToken.uid;

    // Fetch user role from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const role = userDoc.data()?.role;

    console.log(`[LoadStructure] User ${decodedToken.email} has role: ${role}`);

    const locationId = params.id;
    console.log(
      `[LoadStructure] Fetching structure for location: ${locationId}`,
    );

    // Fetch floors from Firestore
    const floorsSnap = await adminDb
      .collection("locations")
      .doc(locationId)
      .collection("floors")
      .orderBy("sortOrder")
      .get();

    const floors = [];

    for (const floorDoc of floorsSnap.docs) {
      const floorData = floorDoc.data();

      // Fetch rooms for this floor
      const roomsSnap = await floorDoc.ref
        .collection("rooms")
        .orderBy("sortOrder")
        .get();

      const rooms = [];

      for (const roomDoc of roomsSnap.docs) {
        const roomData = roomDoc.data();

        // Fetch targets for this room
        const targetsSnap = await roomDoc.ref
          .collection("targets")
          .orderBy("sortOrder")
          .get();

        const targets = [];

        for (const targetDoc of targetsSnap.docs) {
          const targetData = targetDoc.data();

          // Fetch actions for this target
          const actionsSnap = await targetDoc.ref
            .collection("actions")
            .orderBy("sortOrder")
            .get();

          const actions = actionsSnap.docs.map((actionDoc) => ({
            id: actionDoc.id,
            ...actionDoc.data(),
          }));

          targets.push({
            id: targetDoc.id,
            ...targetData,
            actions,
          });
        }

        rooms.push({
          id: roomDoc.id,
          ...roomData,
          targets,
        });
      }

      floors.push({
        id: floorDoc.id,
        ...floorData,
        rooms,
      });
    }

    console.log(`[LoadStructure] Found ${floors.length} floors`);

    // Also fetch location-level intelligence
    const locationDoc = await adminDb
      .collection("locations")
      .doc(locationId)
      .get();
    const locationData = locationDoc.data();

    return NextResponse.json({
      success: true,
      floors,
      hasStructure: floors.length > 0,
      // Intelligence data
      accessInfo: locationData?.accessInfo || null,
      storageLocations: locationData?.storageLocations || [],
      preferences: locationData?.preferences || [],
      restrictions: locationData?.restrictions || [],
    });
  } catch (error: any) {
    console.error("[LoadStructure] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load structure" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error("[Structure] Token verification failed:", err);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const uid = decodedToken.uid;

    // Fetch user role from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const role = userDoc.data()?.role;

    const allowedRoles = [
      "location_owner",
      "admin",
      "superadmin",
      "partner_admin",
    ];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log(`[Structure] User ${decodedToken.email} saving structure`);

    const locationId = params.id;
    const body = await request.json();
    const { floors, accessInfo, storageLocations, preferences, restrictions } =
      body;

    console.log(`[Structure] Saving structure for location ${locationId}`);
    console.log(`[Structure] Floors: ${floors.length}`);

    // Delete existing structure RECURSIVELY
    const existingFloorsSnap = await adminDb
      .collection("locations")
      .doc(locationId)
      .collection("floors")
      .get();

    // Must delete subcollections first (Firestore doesn't cascade delete)
    for (const floorDoc of existingFloorsSnap.docs) {
      // Delete rooms and their subcollections
      const roomsSnap = await floorDoc.ref.collection("rooms").get();
      for (const roomDoc of roomsSnap.docs) {
        // Delete targets and their subcollections
        const targetsSnap = await roomDoc.ref.collection("targets").get();
        for (const targetDoc of targetsSnap.docs) {
          // Delete actions
          const actionsSnap = await targetDoc.ref.collection("actions").get();
          for (const actionDoc of actionsSnap.docs) {
            await actionDoc.ref.delete();
          }
          await targetDoc.ref.delete();
        }
        await roomDoc.ref.delete();
      }
      await floorDoc.ref.delete();
    }

    console.log("[Structure] Deleted existing structure");

    // Save to Firestore (source of truth)
    const batch = adminDb.batch();

    // Save new structure
    for (const floor of floors) {
      const floorRef = adminDb
        .collection("locations")
        .doc(locationId)
        .collection("floors")
        .doc(floor.id);

      batch.set(floorRef, {
        name: floor.name,
        sortOrder: floor.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const room of floor.rooms) {
        const roomRef = floorRef.collection("rooms").doc(room.id);

        batch.set(roomRef, {
          name: room.name,
          type: room.type,
          icon: room.icon,
          sortOrder: room.sortOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        for (const target of room.targets) {
          const targetRef = roomRef.collection("targets").doc(target.id);

          batch.set(targetRef, {
            name: target.name,
            icon: target.icon,
            sortOrder: target.sortOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          for (const action of target.actions) {
            const actionRef = targetRef.collection("actions").doc(action.id);

            batch.set(actionRef, {
              name: action.name,
              durationMinutes: action.durationMinutes,
              sortOrder: action.sortOrder,
              tools: action.tools || [],
              instructions: action.instructions || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    await batch.commit();
    console.log(`[Structure] Saved to Firestore`);

    // Also save intelligence data to location doc
    const locationRef = adminDb.collection("locations").doc(locationId);
    const updateData: any = {
      hasStructure: true,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (accessInfo !== undefined) {
      updateData.accessInfo = accessInfo || null;
    }
    if (storageLocations !== undefined) {
      updateData.storageLocations = storageLocations || [];
    }
    if (preferences !== undefined) {
      updateData.preferences = preferences || [];
    }
    if (restrictions !== undefined) {
      updateData.restrictions = restrictions || [];
    }

    await locationRef.update(updateData);
    console.log(`[Structure] Saved intelligence data to location doc`);

    return NextResponse.json({
      success: true,
      message: "Structure saved",
      floors: floors.length,
    });
  } catch (error: any) {
    console.error("[Structure] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save structure" },
      { status: 500 },
    );
  }
}
