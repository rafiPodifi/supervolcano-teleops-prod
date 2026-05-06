"use server";

import { sql } from "@/lib/db/postgres";

export interface CreateTaskInput {
  organizationId: string;
  locationId: string;
  jobId: string; // Changed from taskId - now references jobs table
  shiftId?: string;

  title: string;
  description: string;

  taskType:
    | "action"
    | "observation"
    | "decision"
    | "navigation"
    | "manipulation";
  actionVerb: string;
  objectTarget?: string;
  roomLocation?: string;

  sequenceOrder: number;
  estimatedDurationSeconds?: number;

  tags: string[];
  keywords: string[];

  source: "manual_entry" | "job_instruction" | "video_ai" | "robot_learning";
  humanVerified: boolean;
  confidenceScore?: number;

  createdBy: string;
}

/**
 * Create a new task (atomic robot-executable step)
 */
export async function createTask(data: CreateTaskInput) {
  try {
    // Use sql.query for arrays support
    const queryText = `
      INSERT INTO tasks (
        organization_id, location_id, job_id, shift_id,
        title, description,
        task_type, action_verb, object_target, room_location,
        sequence_order, estimated_duration_seconds,
        tags, keywords,
        source, human_verified, confidence_score,
        created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9, $10,
        $11, $12,
        $13, $14,
        $15, $16, $17,
        $18
      )
      RETURNING id
    `;

    const params = [
      data.organizationId,
      data.locationId,
      data.jobId,
      data.shiftId || null,
      data.title,
      data.description,
      data.taskType,
      data.actionVerb,
      data.objectTarget || null,
      data.roomLocation || null,
      data.sequenceOrder,
      data.estimatedDurationSeconds || null,
      data.tags || [],
      data.keywords || [],
      data.source,
      data.humanVerified,
      data.confidenceScore || null,
      data.createdBy,
    ];

    const result = await sql.query(queryText, params);

    return { success: true, id: result.rows[0].id };
  } catch (error: any) {
    console.error("Failed to create task:", error);
    return { success: false, error: error.message || "Failed to create task" };
  }
}

/**
 * Get all tasks with filters
 */
export async function getTasks(filters?: {
  locationId?: string;
  jobId?: string; // Changed from taskId
  taskType?: string; // Changed from momentType
  humanVerified?: boolean;
  limit?: number;
  offset?: number;
}) {
  try {
    const {
      locationId,
      jobId,
      taskType,
      humanVerified,
      limit = 50,
      offset = 0,
    } = filters || {};

    const conditions: string[] = ["1=1"];
    const params: any[] = [];
    let paramIndex = 1;

    if (locationId) {
      conditions.push(`t.location_id = $${paramIndex++}`);
      params.push(locationId);
    }

    if (jobId) {
      conditions.push(`t.job_id = $${paramIndex++}`);
      params.push(jobId);
    }

    if (taskType) {
      conditions.push(`t.task_type = $${paramIndex++}`);
      params.push(taskType);
    }

    if (humanVerified !== undefined) {
      conditions.push(`t.human_verified = $${paramIndex++}`);
      params.push(humanVerified);
    }

    params.push(limit, offset);

    const queryText = `
      SELECT 
        t.*,
        l.name as location_name,
        l.address as location_address,
        j.title as job_title,
        j.category as job_category
      FROM tasks t
      JOIN locations l ON t.location_id = l.id
      JOIN jobs j ON t.job_id = j.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex}
    `;

    const result = await sql.query(queryText, params);

    return { success: true, tasks: result.rows };
  } catch (error: any) {
    console.error("Failed to get tasks:", error);
    return {
      success: false,
      error: error.message || "Failed to get tasks",
      tasks: [],
    };
  }
}

/**
 * Get task by ID
 */
export async function getTask(id: string) {
  try {
    const result = await sql`
      SELECT 
        t.*,
        l.name as location_name,
        l.address as location_address,
        j.title as job_title,
        j.description as job_description
      FROM tasks t
      JOIN locations l ON t.location_id = l.id
      JOIN jobs j ON t.job_id = j.id
      WHERE t.id = ${id}
    `;

    if (result.rows.length === 0) {
      return { success: false, error: "Task not found" };
    }

    return { success: true, task: result.rows[0] };
  } catch (error: any) {
    console.error("Failed to get task:", error);
    return { success: false, error: error.message || "Failed to get task" };
  }
}

/**
 * Update task
 */
export async function updateTask(id: string, data: Partial<CreateTaskInput>) {
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.description) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.taskType) {
      updates.push(`task_type = $${paramIndex++}`);
      values.push(data.taskType);
    }

    if (data.actionVerb) {
      updates.push(`action_verb = $${paramIndex++}`);
      values.push(data.actionVerb);
    }

    if (data.objectTarget !== undefined) {
      updates.push(`object_target = $${paramIndex++}`);
      values.push(data.objectTarget);
    }

    if (data.roomLocation !== undefined) {
      updates.push(`room_location = $${paramIndex++}`);
      values.push(data.roomLocation);
    }

    if (data.sequenceOrder !== undefined) {
      updates.push(`sequence_order = $${paramIndex++}`);
      values.push(data.sequenceOrder);
    }

    if (data.estimatedDurationSeconds !== undefined) {
      updates.push(`estimated_duration_seconds = $${paramIndex++}`);
      values.push(data.estimatedDurationSeconds);
    }

    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags || []);
    }

    if (data.keywords !== undefined) {
      updates.push(`keywords = $${paramIndex++}`);
      values.push(data.keywords || []);
    }

    if (data.humanVerified !== undefined) {
      updates.push(`human_verified = $${paramIndex++}`);
      values.push(data.humanVerified);
    }

    if (updates.length === 0) {
      return { success: false, error: "No updates provided" };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await sql.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values,
    );

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update task:", error);
    return { success: false, error: error.message || "Failed to update task" };
  }
}

/**
 * Delete task
 */
export async function deleteTask(id: string) {
  try {
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete task:", error);
    return { success: false, error: error.message || "Failed to delete task" };
  }
}

/**
 * Get tasks count by job
 */
export async function getTaskCountByJob(jobId: string) {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE job_id = ${jobId}
    `;

    return {
      success: true,
      count: parseInt(result.rows[0].count as string) || 0,
    };
  } catch (error: any) {
    console.error("Failed to get task count:", error);
    return { success: false, count: 0 };
  }
}

/**
 * Auto-generate tasks from job instructions (helper)
 */
export async function generateTasksFromInstructions(
  jobId: string,
  locationId: string,
  organizationId: string,
  createdBy: string,
) {
  try {
    // Get job with instructions from Firestore
    // Jobs are stored in location subcollections as "tasks"
    const { adminDb } = await import("@/lib/firebaseAdmin");

    const jobDoc = await adminDb
      .collection("locations")
      .doc(locationId)
      .collection("tasks")
      .doc(jobId)
      .get();

    if (!jobDoc.exists) {
      return { success: false, error: "Job not found" };
    }

    const job = jobDoc.data();

    // Get instructions from job subcollection
    const instructionsSnap = await adminDb
      .collection("locations")
      .doc(locationId)
      .collection("tasks")
      .doc(jobId)
      .collection("instructions")
      .orderBy("stepNumber", "asc")
      .get();

    const instructions = instructionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title as string | undefined,
        description: data.description as string | undefined,
        room: data.room as string | undefined,
        stepNumber: data.stepNumber as number | undefined,
      };
    });

    if (instructions.length === 0) {
      return { success: false, error: "No instructions found for this job" };
    }

    // Get existing task count for this job to set sequence order
    const existingCountResult = await getTaskCountByJob(jobId);
    const existingCount = existingCountResult.count || 0;

    // Create a task for each instruction
    const createdTasks = [];

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];

      // Simple keyword extraction (title words)
      const instructionTitle = instruction.title || "";
      const keywords = instructionTitle
        .toLowerCase()
        .split(" ")
        .filter((word: string) => word.length > 3);

      // Try to infer action verb (first word usually)
      const titleWords = instructionTitle.toLowerCase().split(" ");
      const actionVerb = titleWords[0] || "perform";

      const jobCategory = (job?.category as string) || undefined;

      const taskData: CreateTaskInput = {
        organizationId,
        locationId,
        jobId,
        title: instructionTitle || `Step ${i + 1}`,
        description: instruction.description || instructionTitle || "",
        taskType: "action", // Default, can be refined
        actionVerb: actionVerb,
        objectTarget: undefined,
        roomLocation: instruction.room || jobCategory || undefined,
        sequenceOrder: existingCount + i + 1,
        estimatedDurationSeconds: 60, // Default 1 minute
        tags: [jobCategory, "auto-generated"].filter(Boolean) as string[],
        keywords: keywords,
        source: "job_instruction",
        humanVerified: false,
        confidenceScore: 0.8,
        createdBy,
      };

      const result = await createTask(taskData);
      if (result.success) {
        createdTasks.push(result.id);
      }
    }

    return {
      success: true,
      count: createdTasks.length,
      taskIds: createdTasks,
    };
  } catch (error: any) {
    console.error("Failed to generate tasks:", error);
    return {
      success: false,
      error: error.message || "Failed to generate tasks",
    };
  }
}

/**
 * Link media to a task
 */
export async function linkMediaToTask(
  taskId: string,
  mediaId: string,
  role?: string,
) {
  try {
    await sql`
      INSERT INTO task_media (task_id, media_id, media_role)
      VALUES (${taskId}, ${mediaId}, ${role || "reference"})
      ON CONFLICT (task_id, media_id) DO NOTHING
    `;

    return { success: true };
  } catch (error: any) {
    console.error("Failed to link media to task:", error);
    return { success: false, error: error.message || "Failed to link media" };
  }
}

/**
 * Get all media for a task
 */
export async function getTaskMedia(taskId: string) {
  try {
    const result = await sql`
      SELECT 
        m.*,
        tm.media_role,
        tm.time_offset_seconds
      FROM media m
      JOIN task_media tm ON m.id = tm.media_id
      WHERE tm.task_id = ${taskId}
      ORDER BY m.uploaded_at DESC
    `;

    return { success: true, media: result.rows };
  } catch (error: any) {
    console.error("Failed to get task media:", error);
    return { success: false, media: [], error: error.message };
  }
}
