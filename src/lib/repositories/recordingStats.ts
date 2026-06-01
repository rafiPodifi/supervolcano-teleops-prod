/**
 * Recording-hours aggregation.
 *
 * Sums per-cleaner video recording time from the `media` collection. Media docs
 * carry `uploadedByUserId` (attribution) + `durationSeconds` (encoded length,
 * set server-side by the metadata endpoint) + `recordedAt` (for date ranges).
 *
 * Mirrors the per-user reduce pattern in `analytics.ts` but over media rather
 * than task completions. One helper backs all three role-scoped routes (admin /
 * org / mobile self) — each route supplies the appropriate scope filters.
 */

import { adminDb } from "@/lib/firebaseAdmin";

export interface RecordingHoursFilter {
  /** Scope to a single cleaner (mobile self-view). */
  userId?: string;
  /** Scope to an org (org dashboard). */
  organizationId?: string;
  /** Scope to a single location. */
  locationId?: string;
  /** Inclusive lower bound on recordedAt. */
  from?: Date;
  /** Inclusive upper bound on recordedAt. */
  to?: Date;
}

export interface CleanerRecordingHours {
  userId: string;
  displayName: string;
  email: string | null;
  organizationId: string | null;
  totalSeconds: number;
  totalHours: number;
  videoCount: number;
  lastRecordedAt: string | null; // ISO
}

/**
 * Build a filter from request query params (?from=ISO&to=ISO&locationId=...),
 * merged onto a base scope (e.g. a forced userId or organizationId).
 */
export function buildRecordingFilterFromParams(
  searchParams: URLSearchParams,
  base: RecordingHoursFilter = {},
): RecordingHoursFilter {
  const filter: RecordingHoursFilter = { ...base };

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const locationId = searchParams.get("locationId");

  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) filter.from = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) filter.to = d;
  }
  if (locationId) filter.locationId = locationId;

  return filter;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/**
 * Aggregate recording hours grouped by cleaner. Returns one row per
 * attributed `uploadedByUserId`, sorted by most hours first. Docs without an
 * attributed user are skipped (legacy/unattributed uploads can't be counted).
 */
export async function aggregateRecordingHours(
  filter: RecordingHoursFilter = {},
): Promise<CleanerRecordingHours[]> {
  let query: FirebaseFirestore.Query = adminDb.collection("media");

  if (filter.userId) {
    query = query.where("uploadedByUserId", "==", filter.userId);
  }
  if (filter.organizationId) {
    query = query.where("organizationId", "==", filter.organizationId);
  }
  if (filter.locationId) {
    query = query.where("locationId", "==", filter.locationId);
  }
  // Range filters on recordedAt require the composite indexes in
  // firestore.indexes.json alongside the equality filters above.
  if (filter.from) {
    query = query.where("recordedAt", ">=", filter.from);
  }
  if (filter.to) {
    query = query.where("recordedAt", "<=", filter.to);
  }

  const snapshot = await query.get();

  // Reduce per cleaner.
  const stats = new Map<
    string,
    {
      totalSeconds: number;
      videoCount: number;
      organizationId: string | null;
      lastRecordedAt: Date | null;
    }
  >();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const uid: string | undefined = data.uploadedByUserId;
    if (!uid) continue; // unattributed — can't count toward a cleaner

    const seconds =
      typeof data.durationSeconds === "number" ? data.durationSeconds : 0;
    const recordedAt = toDate(data.recordedAt);

    const entry = stats.get(uid) ?? {
      totalSeconds: 0,
      videoCount: 0,
      organizationId: data.organizationId ?? null,
      lastRecordedAt: null,
    };
    entry.totalSeconds += seconds;
    entry.videoCount += 1;
    if (
      recordedAt &&
      (!entry.lastRecordedAt || recordedAt > entry.lastRecordedAt)
    ) {
      entry.lastRecordedAt = recordedAt;
    }
    stats.set(uid, entry);
  }

  // Resolve cleaner profiles (displayName/email) in one batched read.
  const uids = [...stats.keys()];
  const profiles = await fetchUserProfiles(uids);

  const rows: CleanerRecordingHours[] = uids.map((uid) => {
    const s = stats.get(uid)!;
    const profile = profiles.get(uid);
    return {
      userId: uid,
      displayName: profile?.displayName || profile?.email || uid,
      email: profile?.email ?? null,
      organizationId: s.organizationId,
      totalSeconds: s.totalSeconds,
      totalHours: Math.round((s.totalSeconds / 3600) * 100) / 100,
      videoCount: s.videoCount,
      lastRecordedAt: s.lastRecordedAt?.toISOString() ?? null,
    };
  });

  rows.sort((a, b) => b.totalSeconds - a.totalSeconds);
  return rows;
}

interface UserProfile {
  displayName: string | null;
  email: string | null;
}

async function fetchUserProfiles(
  uids: string[],
): Promise<Map<string, UserProfile>> {
  const result = new Map<string, UserProfile>();
  if (uids.length === 0) return result;

  const refs = uids.map((uid) => adminDb.collection("users").doc(uid));
  const docs = await adminDb.getAll(...refs);
  for (const doc of docs) {
    if (!doc.exists) continue;
    const d = doc.data();
    result.set(doc.id, {
      displayName: d?.displayName ?? null,
      email: d?.email ?? null,
    });
  }
  return result;
}
