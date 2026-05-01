/**
 * Task Completions Repository
 * Data access layer for task completion tracking
 */

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface TaskCompletionInput {
  taskId: string;
  taskTitle: string;
  taskCategory?: string;
  locationId: string;
  locationName: string;
  organizationId: string;
  teleoperatorId: string;
  teleoperatorName: string;
  sessionId?: string; // Link to session
  startedAt: Date | string;
  completedAt: Date | string;
  actualDuration: number;
  estimatedDuration?: number;
  status: "completed" | "incomplete" | "error";
  notes?: string;
  issuesEncountered?: string;
}

export async function recordTaskCompletion(data: TaskCompletionInput) {
  try {
    const completionRef = adminDb.collection("taskCompletions").doc();

    // Convert dates to Firestore timestamps
    const startedAt =
      data.startedAt instanceof Date
        ? Timestamp.fromDate(data.startedAt)
        : Timestamp.fromDate(new Date(data.startedAt));

    const completedAt =
      data.completedAt instanceof Date
        ? Timestamp.fromDate(data.completedAt)
        : Timestamp.fromDate(new Date(data.completedAt));

    await completionRef.set({
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      taskCategory: data.taskCategory || null,
      locationId: data.locationId,
      locationName: data.locationName,
      organizationId: data.organizationId,
      teleoperatorId: data.teleoperatorId,
      teleoperatorName: data.teleoperatorName,
      sessionId: data.sessionId || null, // Link to session
      startedAt: startedAt,
      completedAt: completedAt,
      actualDuration: data.actualDuration,
      estimatedDuration: data.estimatedDuration || null,
      status: data.status,
      notes: data.notes || "",
      issuesEncountered: data.issuesEncountered || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: completionRef.id };
  } catch (error: any) {
    console.error("Failed to record task completion:", error);
    return {
      success: false,
      error: error.message || "Failed to record completion",
    };
  }
}

/**
 * Get task completion status for a task
 */
export async function getTaskCompletionStatus(
  taskId: string,
  sessionId?: string,
) {
  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection("taskCompletions")
      .where("taskId", "==", taskId);

    if (sessionId) {
      query = query.where("sessionId", "==", sessionId);
    }

    const snapshot = await query.orderBy("completedAt", "desc").limit(1).get();

    if (snapshot.empty) {
      return { success: true, completed: false };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const completion = {
      id: doc.id,
      ...data,
      completedAt: data.completedAt,
      startedAt: data.startedAt,
    };

    return { success: true, completed: true, completion };
  } catch (error: any) {
    console.error("Failed to get task completion status:", error);
    return { success: false, error: error.message || "Failed to check status" };
  }
}

/**
 * Check if task was completed in today's session at this location
 */
export async function getTaskCompletionInSession(
  taskId: string,
  sessionId: string,
) {
  try {
    const snapshot = await adminDb
      .collection("taskCompletions")
      .where("taskId", "==", taskId)
      .where("sessionId", "==", sessionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: true, completed: false, completion: null };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      success: true,
      completed: true,
      completion: {
        id: doc.id,
        ...data,
        completedAt: data.completedAt,
        startedAt: data.startedAt,
      },
    };
  } catch (error: any) {
    console.error("Failed to check task completion:", error);
    return { success: false, error: error.message || "Failed to check status" };
  }
}

/**
 * Get all completions for a specific task in today's session
 */
export async function getTaskCompletionsInSession(
  taskId: string,
  sessionId: string,
) {
  try {
    let snapshot;
    try {
      snapshot = await adminDb
        .collection("taskCompletions")
        .where("taskId", "==", taskId)
        .where("sessionId", "==", sessionId)
        .orderBy("completedAt", "desc")
        .get();
    } catch (error: any) {
      // If orderBy fails due to missing index, query without it
      console.warn(
        "[taskCompletions] OrderBy failed, querying without it:",
        error.message,
      );
      snapshot = await adminDb
        .collection("taskCompletions")
        .where("taskId", "==", taskId)
        .where("sessionId", "==", sessionId)
        .get();
    }

    const completions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        completedAt: data.completedAt,
        startedAt: data.startedAt,
      };
    });

    // Sort in memory if orderBy was skipped
    if (completions.length > 0 && !snapshot.query.orderBy.length) {
      completions.sort((a: any, b: any) => {
        const aTime = a.completedAt?.toDate
          ? a.completedAt.toDate().getTime()
          : new Date(a.completedAt).getTime();
        const bTime = b.completedAt?.toDate
          ? b.completedAt.toDate().getTime()
          : new Date(b.completedAt).getTime();
        return bTime - aTime; // Descending
      });
    }

    return { success: true, completions };
  } catch (error: any) {
    console.error("Failed to get task completions:", error);
    return {
      success: false,
      error: error.message || "Failed to load completions",
    };
  }
}

/**
 * Get completion statistics for a task
 */
export async function getTaskCompletionStats(
  taskId: string,
  sessionId?: string,
  days?: number,
) {
  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection("taskCompletions")
      .where("taskId", "==", taskId);

    if (sessionId) {
      query = query.where("sessionId", "==", sessionId);
    }

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const { Timestamp } = await import("firebase-admin/firestore");
      query = query.where("completedAt", ">=", Timestamp.fromDate(cutoffDate));
    }

    const snapshot = await query.get();
    const completions = snapshot.docs.map((doc) => doc.data());

    const totalCount = completions.length;
    const totalDuration = completions.reduce(
      (sum: number, c: any) => sum + (c.actualDuration || 0),
      0,
    );
    const avgDuration =
      totalCount > 0 ? Math.round(totalDuration / totalCount) : 0;

    const statusCounts = {
      completed: completions.filter((c: any) => c.status === "completed")
        .length,
      incomplete: completions.filter((c: any) => c.status === "incomplete")
        .length,
      error: completions.filter((c: any) => c.status === "error").length,
    };

    return {
      success: true,
      stats: {
        totalCount,
        totalDuration,
        avgDuration,
        statusCounts,
        mostRecent: completions.length > 0 ? completions[0] : null,
      },
    };
  } catch (error: any) {
    console.error("Failed to get task stats:", error);
    return { success: false, error: error.message || "Failed to load stats" };
  }
}

/**
 * Get all completions for all tasks in a session (grouped by task)
 */
export async function getSessionTaskCompletions(sessionId: string) {
  try {
    let snapshot;
    try {
      snapshot = await adminDb
        .collection("taskCompletions")
        .where("sessionId", "==", sessionId)
        .orderBy("completedAt", "desc")
        .get();
    } catch (error: any) {
      // If orderBy fails due to missing index, query without it
      console.warn(
        "[taskCompletions] OrderBy failed, querying without it:",
        error.message,
      );
      snapshot = await adminDb
        .collection("taskCompletions")
        .where("sessionId", "==", sessionId)
        .get();
    }

    // Group completions by taskId
    const completionsByTask: Record<string, any[]> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const taskId = data.taskId;

      if (!completionsByTask[taskId]) {
        completionsByTask[taskId] = [];
      }

      completionsByTask[taskId].push({
        id: doc.id,
        ...data,
        completedAt: data.completedAt,
        startedAt: data.startedAt,
      });
    });

    // Sort each task's completions by date (descending)
    Object.keys(completionsByTask).forEach((taskId) => {
      completionsByTask[taskId].sort((a: any, b: any) => {
        const aTime = a.completedAt?.toDate
          ? a.completedAt.toDate().getTime()
          : new Date(a.completedAt).getTime();
        const bTime = b.completedAt?.toDate
          ? b.completedAt.toDate().getTime()
          : new Date(b.completedAt).getTime();
        return bTime - aTime; // Descending
      });
    });

    return { success: true, completions: completionsByTask };
  } catch (error: any) {
    console.error("Failed to get session completions:", error);
    return {
      success: false,
      error: error.message || "Failed to load completions",
    };
  }
}
