# Database Source Audit

Generated: 2024-12-03

## Summary

- **Total API routes using PostgreSQL (sql import)**: 37
- **Total API routes using Firestore (adminDb import)**: 71
- **Potential mismatches identified**: 8

## PostgreSQL Usage (sql import)

### ✅ Correct Usage

| File | Entity | Reason |
|------|--------|--------|
| `api/admin/training/route.ts` | `training_videos` | Training corpus for sale - SQL is appropriate (anonymized data) |
| `api/robot/v1/training/route.ts` | `training_videos` | Public OEM API - SQL is correct (anonymized) |
| `api/admin/library/room-types/route.ts` | `room_types` | Spatial taxonomy reference table - SQL is correct |
| `api/admin/library/target-types/route.ts` | `target_types` | Spatial taxonomy reference table - SQL is correct |
| `api/admin/library/action-types/route.ts` | `action_types` | Spatial taxonomy reference table - SQL is correct |
| `api/admin/locations/[id]/structure/route.ts` | `rooms`, `targets`, `actions` | Spatial taxonomy for location - SQL is correct |
| `api/admin/locations/[id]/rooms/route.ts` | `rooms` | Spatial taxonomy - SQL is correct |
| `api/admin/rooms/[roomId]/targets/route.ts` | `targets` | Spatial taxonomy - SQL is correct |
| `api/admin/targets/[targetId]/actions/route.ts` | `actions` | Spatial taxonomy - SQL is correct |
| `api/admin/taxonomy/*` | Taxonomy tables | Reference data - SQL is correct |
| `api/admin/setup-database/route.ts` | Database setup | Schema creation - SQL is correct |
| `api/admin/cleanup-sql-orphans/route.ts` | Cleanup utility | SQL maintenance - appropriate |
| `api/robot/v1/query/route.ts` | `jobs`, `tasks`, `moments` | Robot analytics query - SQL is appropriate (synced data) |
| `api/robot/v1/feedback/route.ts` | `robot_executions` | Robot feedback storage - SQL is appropriate |
| `api/robot/sessions/route.ts` | `shifts` | Analytics - SQL is appropriate (synced from Firestore) |
| `api/admin/robot-intelligence/stats/route.ts` | Stats aggregation | Analytics - SQL is appropriate for aggregated data |

### ❌ Incorrect Usage (Should Use Firestore)

| File | Entity | Current Query | Recommendation |
|------|--------|---------------|----------------|
| `api/robot/media/route.ts` | `media` | `SELECT from media table` | Query Firestore `media` collection |
| `api/robot/jobs/[id]/videos/route.ts` | `media` | `SELECT from media table` | Query Firestore `media` collection where `jobId` matches |
| `api/admin/media/upload/route.ts` | `media` | Writes to SQL `media` table | Should write to Firestore `media` collection (currently also writes to Storage) |
| `api/users/[userId]/assigned-locations/route.ts` | `location_assignments` | `SELECT from location_assignments` | Query Firestore `locations` collection with `assignedOrganizations` array |

### ⚠️ Needs Review

| File | Entity | Notes |
|------|--------|-------|
| `api/admin/locations/route.ts` | `locations` | **Dual source**: Reads from Firestore (✅ correct), but imports SQL. Used for sync operations? |
| `api/admin/jobs/route.ts` | `jobs` | **Analytics layer**: Queries SQL `jobs` table. These are synced from Firestore tasks. Correct for analytics, but confirm sync strategy. |
| `api/robot/jobs/route.ts` | `jobs` | **Analytics layer**: Queries SQL `jobs` table. These are synced from Firestore. Correct for analytics API. |
| `api/robot/locations/route.ts` | `locations` | **Analytics layer**: Queries SQL `locations` table. These are synced from Firestore. Correct for analytics API. |
| `api/robot/locations/[id]/route.ts` | `locations` | **Analytics layer**: Queries SQL `locations` table. Correct for analytics. |
| `api/robot/locations/[id]/jobs/route.ts` | `jobs` | **Analytics layer**: Queries SQL `jobs` table. Correct for analytics. |
| `api/admin/tasks/[id]/route.ts` | `tasks` | **Dual usage**: Uses both Firestore and SQL. Needs review. |
| `api/admin/robot-intelligence/locations/route.ts` | `locations` | **Analytics layer**: Queries SQL. Should be OK if it's for analytics only. |
| `api/admin/robot-intelligence/tasks/route.ts` | `jobs` | **Analytics layer**: Queries SQL. Should be OK if it's for analytics only. |
| `api/admin/locations/[id]/generate-tasks/route.ts` | `jobs`, `tasks` | **Mixed**: Reads from Firestore locations, writes to SQL jobs. Needs clear sync strategy. |
| `api/admin/sync/all/route.ts` | Sync service | **Sync utility**: Reads Firestore, writes SQL. This is correct - it's the sync service. |
| `api/v1/locations/route.ts` | `locations` | **Needs review**: Queries SQL. Should query Firestore for operational data. |
| `api/admin/cleanup-tasks/route.ts` | `tasks`, `jobs` | **Cleanup utility**: Operates on SQL. Needs review if tasks are in Firestore. |

## Firestore Usage (adminDb import)

### ✅ Correct Usage

**Operational Data (Source of Truth in Firestore):**

- `api/admin/videos/route.ts` - Media/videos ✅ (Just fixed!)
- `api/admin/videos/process/route.ts` - Video processing
- `api/sessions/[sessionId]/media/route.ts` - Media upload
- `api/admin/locations/route.ts` - Locations (source of truth)
- `api/admin/locations/[id]/firestore/route.ts` - Location details
- `api/admin/locations/[id]/media/route.ts` - Location media
- `api/admin/locations/[id]/tasks/route.ts` - Location tasks
- `api/admin/locations/[id]/tasks/firestore/route.ts` - Location tasks
- `api/admin/locations/[id]/floors/route.ts` - Location structure (Firestore)
- `api/admin/locations/[id]/floors/[floorId]/rooms/route.ts` - Location structure
- `api/admin/locations/[id]/rooms/[roomId]/targets/route.ts` - Location structure
- `api/admin/locations/[id]/targets/[targetId]/actions/route.ts` - Location structure
- `api/admin/locations/[id]/actions/[actionId]/tools/route.ts` - Location structure
- `api/admin/locations/[id]/assignments/route.ts` - Location assignments
- `api/locations/route.ts` - Locations list
- `api/locations/[id]/available-cleaners/route.ts` - Location cleaners
- `api/locations/[id]/assignments/route.ts` - Location assignments
- `api/session/start/route.ts` - Sessions (source of truth)
- `api/session/stop/route.ts` - Sessions (source of truth)
- `api/admin/sessions/export/route.ts` - Sessions export
- `api/admin/tasks/route.ts` - Tasks (source of truth)
- `api/admin/tasks/[id]/route.ts` - Task details
- `api/admin/tasks/[id]/media/route.ts` - Task media
- `api/admin/media/metadata/route.ts` - Media metadata
- `api/admin/sync-media/route.ts` - Media sync
- `api/admin/test-media-sync/route.ts` - Media sync test
- `api/admin/sync/all/route.ts` - Sync service (reads Firestore)
- `api/admin/users/*` - User management (Firebase Auth + Firestore)
- `api/admin/organizations/*` - Organizations (source of truth)
- `api/admin/seed/route.ts` - Seed data (writes to Firestore)
- All migration routes - Write to Firestore

## Data Entity Source of Truth Matrix

| Entity | Source of Truth | Secondary Storage | Sync Direction | Notes |
|--------|-----------------|-------------------|----------------|-------|
| Users | Firebase Auth + Firestore `users` | - | - | Firebase Auth for auth, Firestore for profile |
| Organizations | Firestore `organizations` | - | - | Source of truth |
| Locations | Firestore `locations` | PostgreSQL `locations` | Firestore → SQL | Synced for analytics |
| Tasks | Firestore `tasks` (subcollection) | PostgreSQL `jobs` | Firestore → SQL | Synced for analytics |
| Sessions | Firestore `sessions` | PostgreSQL `shifts` | Firestore → SQL | Synced for analytics |
| Media/Videos | Firestore `media` | - | - | **Source of truth** - should NOT be in SQL |
| Location Intelligence | Firestore (location fields) | - | - | Access info, preferences, etc. |
| Location Structure | **BOTH** | - | - | Firestore: location-specific structure. SQL: taxonomy library |
| Training Videos | PostgreSQL `training_videos` | - | - | Anonymized corpus for sale |
| Spatial Taxonomy | PostgreSQL | - | - | Reference tables: room_types, target_types, action_types |
| Location Assignments | Firestore (in location doc) | PostgreSQL `location_assignments` | Firestore → SQL? | Needs confirmation |
| Robot Executions | PostgreSQL `robot_executions` | - | - | Analytics/feedback storage |

## Recommended Fixes

### High Priority

1. **`api/robot/media/route.ts`**
   - **Issue**: Queries SQL `media` table
   - **Fix**: Query Firestore `media` collection instead
   - **Impact**: Robot API may return stale/incomplete media data

2. **`api/robot/jobs/[id]/videos/route.ts`**
   - **Issue**: Queries SQL `media` table
   - **Fix**: Query Firestore `media` collection filtered by `taskId` or `jobId`
   - **Impact**: Robot API missing videos

3. **`api/admin/media/upload/route.ts`**
   - **Issue**: Writes to SQL `media` table (line 2 imports SQL)
   - **Fix**: Remove SQL write, only write to Firestore `media` collection and Firebase Storage
   - **Impact**: Dual-write inconsistency

4. **`api/users/[userId]/assigned-locations/route.ts`**
   - **Issue**: Queries SQL `location_assignments` table
   - **Fix**: Query Firestore `locations` collection where `assignedOrganizations` array contains user's org, or check location assignment subcollection
   - **Impact**: Mobile app may show incorrect location assignments

### Medium Priority

5. **`api/v1/locations/route.ts`**
   - **Issue**: Queries SQL for operational location data
   - **Fix**: Should query Firestore if this is for operational use (not analytics)
   - **Impact**: Depends on use case - if operational, needs fix

6. **`api/admin/locations/[id]/generate-tasks/route.ts`**
   - **Issue**: Reads Firestore, writes SQL jobs directly
   - **Fix**: Write tasks to Firestore, let sync service handle SQL write
   - **Impact**: Tasks may not appear in Firestore immediately

### Low Priority (Review/Clarify)

7. **Robot API endpoints** (`/api/robot/*`)
   - **Status**: These appear to be analytics/read-only APIs
   - **Recommendation**: Keep SQL queries if these are intended as analytics APIs
   - **Action**: Document that Robot API is analytics-only and uses synced data

8. **`api/admin/cleanup-tasks/route.ts`**
   - **Issue**: Cleans up SQL tasks
   - **Fix**: Should clean up Firestore tasks, let sync service handle SQL
   - **Impact**: Cleanup may miss Firestore tasks

## Dual-Write Locations (Potential Issues)

### Currently Dual-Writing

1. **`api/admin/locations/[id]/generate-tasks/route.ts`**
   - **Behavior**: Reads from Firestore locations, writes directly to SQL `jobs`
   - **Issue**: Tasks may not be in Firestore
   - **Recommendation**: Write to Firestore first, use sync service for SQL

2. **`api/admin/media/upload/route.ts`**
   - **Behavior**: Writes to Firebase Storage, may write to SQL
   - **Issue**: Should only write to Firestore
   - **Recommendation**: Remove SQL writes

### Sync Services (Correct Dual-Write)

1. **`api/admin/sync/all/route.ts`**
   - **Behavior**: Reads Firestore, writes SQL (one-way sync)
   - **Status**: ✅ Correct - this is the sync service
   - **Direction**: Firestore → SQL (one-way)

2. **`lib/services/sync/firestoreToSql.ts`**
   - **Behavior**: Syncs locations, sessions, jobs, media from Firestore to SQL
   - **Status**: ✅ Correct - this is the sync utility

## Architecture Notes

### Robot Intelligence API

The `/api/robot/*` endpoints appear to be designed as **analytics/read-only APIs** that serve synced data from PostgreSQL. This is intentional for:

- Better query performance (SQL joins)
- Analytics aggregations
- Public API with API key auth (separate from operational auth)

**Recommendation**: Keep Robot API on SQL, but document that it's analytics-only.

### Location Structure: Dual Model

Locations have structure in TWO places:

1. **Firestore**: Location-specific structure (floors/rooms/targets/actions) as subcollections
2. **PostgreSQL**: Taxonomy library (room_types, target_types, action_types) as reference tables

This is **correct** - Firestore holds instance data, SQL holds reference/taxonomy data.

## Next Steps

1. ✅ **Fixed**: `api/admin/videos/route.ts` - Now uses Firestore
2. 🔴 **Fix**: `api/robot/media/route.ts` - Switch to Firestore
3. 🔴 **Fix**: `api/robot/jobs/[id]/videos/route.ts` - Switch to Firestore  
4. 🔴 **Fix**: `api/admin/media/upload/route.ts` - Remove SQL writes
5. 🔴 **Fix**: `api/users/[userId]/assigned-locations/route.ts` - Switch to Firestore
6. 🟡 **Review**: Document Robot API as analytics-only
7. 🟡 **Review**: Confirm location assignments are in Firestore
8. 🟡 **Review**: Task generation should write to Firestore first

## Sync Strategy Confirmation Needed

- [ ] Confirm `location_assignments` table is synced from Firestore or if assignments are stored differently
- [ ] Confirm Robot API is intentionally analytics-only (using synced SQL data)
- [ ] Document sync frequency and strategy for locations → SQL
- [ ] Document sync strategy for tasks → jobs

---

**Audit completed by**: AI Assistant  
**Review recommended by**: Development team lead

