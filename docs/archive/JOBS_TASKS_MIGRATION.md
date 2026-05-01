# Jobs/Tasks Architecture Migration

## Overview

This migration renames the hierarchical architecture from "Tasks/Moments" to "Jobs/Tasks" for clarity:

- **Jobs** = High-level assignments (e.g., "Clean Kitchen") - what humans create
- **Tasks** = Atomic robot-executable steps (e.g., "Wipe counter") - what robots execute

## Migration Steps

### 1. Run SQL Migration (REQUIRED FIRST)

**IMPORTANT**: You must run the SQL migration script **before** deploying the code changes.

1. Open your Neon PostgreSQL console
2. Copy and paste the contents of `database/migration_jobs_tasks.sql`
3. Execute the script
4. Verify the migration succeeded by checking:
   - Tables `jobs` and `tasks` exist (not `moments`)
   - Column `task_id` in `tasks` table references `jobs.id`
   - Column `task_id` in `location_preferences` exists

### 2. Code Changes (Already Complete)

All code changes have been made:

✅ **SQL Migration Script**: `database/migration_jobs_tasks.sql`
✅ **Sync Functions**: Updated to sync "jobs" from Firestore "tasks"
✅ **Repositories**: 
   - Created `lib/repositories/sql/tasks.ts` (replaces `moments.ts`)
   - Old `moments.ts` deleted
✅ **API Routes**:
   - `/api/admin/tasks/*` (replaces `/api/admin/moments/*`)
   - Robot API updated to use new terminology
   - Preferences API updated
✅ **UI Components**:
   - Robot Intelligence page updated
   - Location Preferences Panel updated
   - Admin location detail page updated
✅ **Stats API**: Updated to query `tasks` table

### 3. What Changed

#### Database Tables
- `tasks` → `jobs` (high-level assignments)
- `moments` → `tasks` (atomic robot steps)
- `moment_media` → `task_media`
- `location_preferences.moment_id` → `location_preferences.task_id`
- `robot_executions.moment_id` → `robot_executions.task_id`
- `media.task_id` → `media.job_id`

#### Code Terminology
- All "moment" references → "task"
- All "task" (high-level) references → "job"
- API endpoints: `/api/admin/moments/*` → `/api/admin/tasks/*`
- Function names: `createMoment` → `createTask`, etc.

#### UI Text
- "Create Moment" → "Create Task"
- "Moments Created" → "Tasks Created"
- "View Moments" → "View Tasks"

### 4. Testing Checklist

After running the SQL migration:

- [ ] SQL tables renamed successfully
- [ ] Indexes renamed
- [ ] Views recreated
- [ ] Triggers working
- [ ] Foreign keys intact
- [ ] Locations sync to SQL
- [ ] Jobs sync from Firestore
- [ ] Tasks can be created in Robot Intelligence
- [ ] Robot API returns tasks (not moments)
- [ ] Location preferences work
- [ ] Admin UI shows "Tasks" instead of "Moments"
- [ ] All references updated

### 5. Breaking Changes

⚠️ **API Changes**:
- `/api/admin/moments/*` → `/api/admin/tasks/*`
- Robot API response: `results.moments` → `results.tasks`
- Robot feedback API: `momentId` → `taskId`

⚠️ **Database Changes**:
- All existing "moments" data will be in the `tasks` table after migration
- Location preferences will need to reference `task_id` instead of `moment_id`

### 6. Rollback Plan

If you need to rollback:

1. Restore the old code from git
2. Run reverse SQL migration (rename tables back)
3. Note: This will lose any new data created after migration

## Next Steps

1. **Run the SQL migration** in Neon console
2. **Deploy the code changes** to Vercel
3. **Test all functionality** using the checklist above
4. **Update any external documentation** that references the old terminology

## Questions?

If you encounter issues:
- Check the SQL migration ran successfully
- Verify all environment variables are set
- Check browser console for API errors
- Review server logs for database errors

