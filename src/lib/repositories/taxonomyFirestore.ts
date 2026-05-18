/**
 * Taxonomy + library lookups, Firestore-backed.
 *
 * Replaces the Postgres tables: action_types, room_types, target_types,
 * task_categories, task_templates. Keeps response field names in
 * snake_case so existing frontend code keeps working.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type Doc = FirebaseFirestore.DocumentSnapshot;

const COLL = {
  actionTypes: "libraryActionTypes",
  roomTypes: "libraryRoomTypes",
  targetTypes: "libraryTargetTypes",
  taskCategories: "taskCategories",
  taskTemplates: "taskTemplates",
} as const;

function asRecord(doc: Doc): Record<string, unknown> | null {
  if (!doc.exists) return null;
  const data = doc.data() ?? {};
  return { id: doc.id, ...data };
}

async function createDoc(collection: string, payload: Record<string, unknown>) {
  const ref = adminDb.collection(collection).doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    ...payload,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  const snap = await ref.get();
  return asRecord(snap);
}

async function patchDoc(
  collection: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const ref = adminDb.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null) filtered[k] = v;
  }
  filtered.updated_at = FieldValue.serverTimestamp();
  await ref.update(filtered);
  return asRecord(await ref.get());
}

async function softDelete(collection: string, id: string) {
  const ref = adminDb.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({
    is_active: false,
    updated_at: FieldValue.serverTimestamp(),
  });
  return true;
}

async function listActive(
  collection: string,
  orderBy: Array<{ field: string; dir: "asc" | "desc" }> = [
    { field: "name", dir: "asc" },
  ],
) {
  let q: FirebaseFirestore.Query = adminDb
    .collection(collection)
    .where("is_active", "==", true);
  for (const o of orderBy) q = q.orderBy(o.field, o.dir);
  const snap = await q.get();
  return snap.docs.map((d) => asRecord(d)!);
}

export const actionTypes = {
  list: () => listActive(COLL.actionTypes),
  create: (input: {
    name: string;
    description?: string | null;
    estimated_duration_minutes?: number;
    tools_required?: unknown;
    instructions?: string | null;
  }) =>
    createDoc(COLL.actionTypes, {
      name: input.name,
      description: input.description ?? null,
      estimated_duration_minutes: input.estimated_duration_minutes ?? 5,
      tools_required: input.tools_required ?? null,
      instructions: input.instructions ?? null,
    }),
};

export const roomTypes = {
  list: () =>
    listActive(COLL.roomTypes, [
      { field: "sort_order", dir: "asc" },
      { field: "name", dir: "asc" },
    ]),
  create: (input: {
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string;
    default_targets?: unknown;
  }) =>
    createDoc(COLL.roomTypes, {
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? "#3B82F6",
      default_targets: input.default_targets ?? null,
      sort_order: 0,
    }),
};

export const targetTypes = {
  list: () => listActive(COLL.targetTypes),
  create: (input: {
    name: string;
    description?: string | null;
    icon?: string | null;
    default_actions?: unknown;
  }) =>
    createDoc(COLL.targetTypes, {
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      default_actions: input.default_actions ?? null,
    }),
};

export const taskCategories = {
  async list() {
    const cats = await listActive(COLL.taskCategories, [
      { field: "sort_order", dir: "asc" },
      { field: "name", dir: "asc" },
    ]);

    const templatesSnap = await adminDb
      .collection(COLL.taskTemplates)
      .where("is_active", "==", true)
      .select("category_id")
      .get();

    const counts = new Map<string, number>();
    for (const doc of templatesSnap.docs) {
      const cid = (doc.data() as { category_id?: string }).category_id;
      if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }

    return cats.map((c) => ({
      ...c,
      template_count: counts.get(c.id as string) ?? 0,
    }));
  },
  create: (input: {
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string;
    sort_order?: number;
  }) =>
    createDoc(COLL.taskCategories, {
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? "#3B82F6",
      sort_order: input.sort_order ?? 0,
    }),
  patch: (id: string, input: Record<string, unknown>) =>
    patchDoc(COLL.taskCategories, id, input),
  softDelete: (id: string) => softDelete(COLL.taskCategories, id),
};

async function decorateTemplate(
  t: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!t.category_id) {
    return {
      ...t,
      category_name: null,
      category_color: null,
      category_icon: null,
    };
  }
  const cat = await adminDb
    .collection(COLL.taskCategories)
    .doc(t.category_id as string)
    .get();
  const data = cat.exists ? cat.data() : null;
  return {
    ...t,
    category_name: data?.name ?? null,
    category_color: data?.color ?? null,
    category_icon: data?.icon ?? null,
  };
}

export const taskTemplates = {
  async list(categoryId?: string | null) {
    let q: FirebaseFirestore.Query = adminDb
      .collection(COLL.taskTemplates)
      .where("is_active", "==", true);
    if (categoryId) q = q.where("category_id", "==", categoryId);
    q = q.orderBy("name", "asc");
    const snap = await q.get();
    const rows = snap.docs.map((d) => asRecord(d)!);
    return Promise.all(rows.map(decorateTemplate));
  },
  async get(id: string) {
    const snap = await adminDb.collection(COLL.taskTemplates).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || data.is_active === false) return null;
    return decorateTemplate(asRecord(snap)!);
  },
  create: (input: {
    category_id?: string | null;
    name: string;
    description?: string | null;
    steps?: unknown;
    tools_required?: unknown;
    safety_notes?: unknown;
    instruction_video_url?: string | null;
    instruction_images?: unknown;
    estimated_duration_minutes?: number;
    difficulty_level?: string;
    priority?: string;
  }) =>
    createDoc(COLL.taskTemplates, {
      category_id: input.category_id ?? null,
      name: input.name,
      description: input.description ?? null,
      steps: input.steps ?? null,
      tools_required: input.tools_required ?? null,
      safety_notes: input.safety_notes ?? null,
      instruction_video_url: input.instruction_video_url ?? null,
      instruction_images: input.instruction_images ?? null,
      estimated_duration_minutes: input.estimated_duration_minutes ?? 15,
      difficulty_level: input.difficulty_level ?? "medium",
      priority: input.priority ?? "medium",
    }),
  patch: (id: string, input: Record<string, unknown>) =>
    patchDoc(COLL.taskTemplates, id, input),
  softDelete: (id: string) => softDelete(COLL.taskTemplates, id),
};
