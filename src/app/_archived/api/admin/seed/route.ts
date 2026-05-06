import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiAuth";

async function seedOrganizations() {
  const orgRef = adminDb.collection("organizations").doc("demo-org");
  await orgRef.set(
    {
      name: "Demo Partner Org",
      slug: "demo-org",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function seedUsers() {
  const email = "operator@demo.org";
  let user = null;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch {
    user = await adminAuth.createUser({
      email,
      password: "ChangeMe123!",
      displayName: "Demo Operator",
    });
  }

  await adminAuth.setCustomUserClaims(user.uid, {
    role: "operator",
    partner_org_id: "demo-org",
  });

  await adminDb
    .collection("users")
    .doc(user.uid)
    .set(
      {
        email,
        displayName: "Demo Operator",
        role: "operator",
        partnerOrgId: "demo-org",
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

async function seedProperties() {
  const properties = [
    {
      id: "demo-property-1",
      name: "Mount Ember Facility",
      partnerOrgId: "demo-org",
      status: "online",
      address: "1 Fissure Way, Reykjavik, Iceland",
      images: [
        "https://images.unsplash.com/photo-1529429617124-aee11bad5112?auto=format&fit=crop&w=960&q=80",
        "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=960&q=80",
      ],
      media: [
        {
          id: "demo-property-1-image-1",
          url: "https://images.unsplash.com/photo-1529429617124-aee11bad5112?auto=format&fit=crop&w=960&q=80",
          type: "image" as const,
        },
        {
          id: "demo-property-1-image-2",
          url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=960&q=80",
          type: "image" as const,
        },
        {
          id: "demo-property-1-video-1",
          url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
          type: "video" as const,
        },
      ],
      imageCount: 2,
      videoCount: 1,
    },
    {
      id: "demo-property-2",
      name: "Kilauea Outpost",
      partnerOrgId: "demo-org",
      status: "maintenance",
      address: "88 Lava Field Rd, Hilo, Hawaii",
      images: [
        "https://images.unsplash.com/photo-1529429617124-aee11bad5112?auto=format&fit=crop&w=960&q=80",
      ],
      media: [
        {
          id: "demo-property-2-image-1",
          url: "https://images.unsplash.com/photo-1529429617124-aee11bad5112?auto=format&fit=crop&w=960&q=80",
          type: "image" as const,
        },
      ],
      imageCount: 1,
      videoCount: 0,
    },
  ];

  await Promise.all(
    properties.map((property) =>
      adminDb
        .collection("locations")
        .doc(property.id)
        .set(
          {
            ...property,
            taskCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
    ),
  );
}

async function seedTaskTemplates() {
  const templates = [
    {
      id: "safety-check",
      name: "Safety Checklist",
      description: "Pre-operation safety checklist for teleoperator session.",
      partnerOrgId: "demo-org",
    },
    {
      id: "drone-survey",
      name: "Drone Survey",
      description: "Remote drone flight and visual inspection procedure.",
      partnerOrgId: "demo-org",
    },
  ];

  await Promise.all(
    templates.map((template) =>
      adminDb
        .collection("taskTemplates")
        .doc(template.id)
        .set(
          {
            ...template,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
    ),
  );
}

async function seedTasks() {
  const tasks = [
    {
      id: "task-available-1",
      name: "Thermal sensor calibration",
      locationId: "demo-property-1",
      partnerOrgId: "demo-org",
      status: "available" as const,
      assignment: "oem_teleoperator" as const,
      duration: 45,
      priority: "high" as const,
    },
    {
      id: "task-inprogress-1",
      name: "Drone reconnaissance sweep",
      locationId: "demo-property-2",
      partnerOrgId: "demo-org",
      status: "in_progress" as const,
      assignment: "oem_teleoperator" as const,
      duration: 90,
      priority: "medium" as const,
    },
    {
      id: "task-human-1",
      name: "Containment bay mop",
      locationId: "demo-property-1",
      partnerOrgId: "demo-org",
      status: "scheduled" as const,
      assignment: "human" as const,
      duration: 60,
      priority: "low" as const,
    },
  ];

  await Promise.all(
    tasks.map((task) =>
      adminDb
        .collection("tasks")
        .doc(task.id)
        .set(
          {
            ...task,
            assigned_to: task.assignment,
            state: task.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assignedToUserId: null,
          },
          { merge: true },
        ),
    ),
  );

  const taskCounts: Record<string, number> = {};
  tasks.forEach((task) => {
    taskCounts[task.locationId] = (taskCounts[task.locationId] ?? 0) + 1;
  });

  await Promise.all(
    Object.entries(taskCounts).map(([locationId, count]) =>
      adminDb
        .collection("locations")
        .doc(locationId)
        .set({ taskCount: count }, { merge: true }),
    ),
  );
}

async function seedSessions() {
  const sessionRef = adminDb.collection("sessions").doc("session-demo-1");
  await sessionRef.set(
    {
      operatorId: "operator@demo.org",
      partnerOrgId: "demo-org",
      taskId: "task-inprogress-1",
      allowedHours: 4,
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: "active",
    },
    { merge: true },
  );

  await adminDb
    .collection("locations")
    .doc("demo-property-2")
    .set({ activeSessionId: "session-demo-1" }, { merge: true });
}

async function seedAuditLogs() {
  const logRef = adminDb.collection("auditLogs").doc("log-demo-1");
  await logRef.set(
    {
      entityId: "task-inprogress-1",
      entityType: "task",
      action: "state_changed",
      actorId: "operator@demo.org",
      details: {
        from: "available",
        to: "in_progress",
      },
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function POST(request: NextRequest) {
  const authorized = await requireAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(
      "[seed] starting with project",
      process.env.FIREBASE_ADMIN_PROJECT_ID,
      "client",
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    );
    await Promise.all([
      seedOrganizations().catch((error) => {
        console.error("[seed] organizations failed", error);
        throw error;
      }),
      seedUsers().catch((error) => {
        console.error("[seed] users failed", error);
        throw error;
      }),
      seedProperties().catch((error) => {
        console.error("[seed] properties failed", error);
        throw error;
      }),
      seedTaskTemplates().catch((error) => {
        console.error("[seed] templates failed", error);
        throw error;
      }),
      seedTasks().catch((error) => {
        console.error("[seed] tasks failed", error);
        throw error;
      }),
      seedSessions().catch((error) => {
        console.error("[seed] sessions failed", error);
        throw error;
      }),
      seedAuditLogs().catch((error) => {
        console.error("[seed] audit logs failed", error);
        throw error;
      }),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[seed] unhandled error", error);
    const message =
      error instanceof Error ? error.message : "Failed to seed sample data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

