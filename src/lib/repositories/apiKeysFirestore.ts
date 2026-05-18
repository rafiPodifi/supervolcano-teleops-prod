/**
 * API key management + usage tracking, Firestore-backed.
 *
 * Replaces Postgres `api_keys` and `api_usage` tables. Each robot API
 * request does one Firestore read (`apiKeys` where keyHash == ...) and
 * one Firestore write (`apiUsage` append). Acceptable latency budget
 * accepted in audit 2026-05-18.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const KEYS = "apiKeys";
const USAGE = "apiUsage";

export type ApiKeyDoc = {
  id: string;
  keyHash: string;
  keyPrefix: string;
  organizationId: string;
  organizationName: string;
  isActive: boolean;
  rateLimitPerHour: number | null;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  lastUsedAt: FirebaseFirestore.Timestamp | null;
  expiresAt: FirebaseFirestore.Timestamp | null;
};

export const apiKeys = {
  async create(input: {
    keyHash: string;
    keyPrefix: string;
    organizationId: string;
    organizationName: string;
    createdBy: string;
    expiresAt: Date | null;
  }) {
    const ref = adminDb.collection(KEYS).doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({
      keyHash: input.keyHash,
      keyPrefix: input.keyPrefix,
      organizationId: input.organizationId,
      organizationName: input.organizationName,
      createdBy: input.createdBy,
      isActive: true,
      rateLimitPerHour: 1000,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: input.expiresAt ?? null,
    });
    return ref.id;
  },

  async findActiveByHash(keyHash: string) {
    const snap = await adminDb
      .collection(KEYS)
      .where("keyHash", "==", keyHash)
      .where("isActive", "==", true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as ApiKeyDoc;
  },

  async touchLastUsed(id: string) {
    await adminDb.collection(KEYS).doc(id).update({
      lastUsedAt: FieldValue.serverTimestamp(),
    });
  },

  async list() {
    const snap = await adminDb
      .collection(KEYS)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        key_prefix: data.keyPrefix,
        organization_id: data.organizationId,
        organization_name: data.organizationName,
        is_active: data.isActive,
        rate_limit_per_hour: data.rateLimitPerHour,
        created_at: data.createdAt,
        last_used_at: data.lastUsedAt,
        expires_at: data.expiresAt,
      };
    });
  },
};

export const apiUsage = {
  async record(input: {
    organizationId: string;
    endpoint: string;
    method: string;
    statusCode: number;
  }) {
    await adminDb.collection(USAGE).add({
      organizationId: input.organizationId,
      endpoint: input.endpoint,
      method: input.method,
      statusCode: input.statusCode,
      ts: FieldValue.serverTimestamp(),
    });
  },
};
