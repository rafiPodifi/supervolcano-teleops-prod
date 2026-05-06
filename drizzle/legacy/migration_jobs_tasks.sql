-- ============================================
-- Migration: Rename Tasks/Moments to Jobs/Tasks
-- ============================================
-- This migration renames the hierarchical architecture:
-- - "tasks" (high-level) → "jobs" 
-- - "moments" (atomic) → "tasks"
--
-- IMPORTANT: Views must be created AFTER location_preferences migration
-- ============================================

BEGIN;

-- Step 1: Rename tables
ALTER TABLE tasks RENAME TO jobs;
ALTER TABLE moments RENAME TO tasks;
ALTER TABLE moment_media RENAME TO task_media;

-- Step 2: Update foreign key column names in tasks table (formerly moments)
ALTER TABLE tasks RENAME COLUMN task_id TO job_id;

-- Step 3: Update foreign key column names in task_media table
ALTER TABLE task_media RENAME COLUMN moment_id TO task_id;

-- Step 4: Update indexes for jobs table (formerly tasks)
ALTER INDEX IF EXISTS idx_tasks_location RENAME TO idx_jobs_location;
ALTER INDEX IF EXISTS idx_tasks_category RENAME TO idx_jobs_category;
ALTER INDEX IF EXISTS idx_tasks_title RENAME TO idx_jobs_title;

-- Step 5: Update indexes for tasks table (formerly moments)
ALTER INDEX IF EXISTS idx_moments_location RENAME TO idx_tasks_location;
ALTER INDEX IF EXISTS idx_moments_task RENAME TO idx_tasks_job;
ALTER INDEX IF EXISTS idx_moments_shift RENAME TO idx_tasks_shift;
ALTER INDEX IF EXISTS idx_moments_type RENAME TO idx_tasks_type;
ALTER INDEX IF EXISTS idx_moments_verb RENAME TO idx_tasks_verb;
ALTER INDEX IF EXISTS idx_moments_room RENAME TO idx_tasks_room;
ALTER INDEX IF EXISTS idx_moments_verified RENAME TO idx_tasks_verified;
ALTER INDEX IF EXISTS idx_moments_tags RENAME TO idx_tasks_tags;
ALTER INDEX IF EXISTS idx_moments_keywords RENAME TO idx_tasks_keywords;
ALTER INDEX IF EXISTS idx_moments_sequence RENAME TO idx_tasks_sequence;
ALTER INDEX IF EXISTS idx_moments_fulltext RENAME TO idx_tasks_fulltext;

-- Step 6: Update indexes for task_media table
ALTER INDEX IF EXISTS idx_moment_media_moment RENAME TO idx_task_media_task;
ALTER INDEX IF EXISTS idx_moment_media_media RENAME TO idx_task_media_media;

-- Step 7: Drop old views (will recreate after location_preferences migration)
DROP VIEW IF EXISTS moments_enriched;
DROP VIEW IF EXISTS task_performance;

-- Step 8: Update functions/triggers
DROP TRIGGER IF EXISTS trigger_update_moment_stats ON robot_executions;
DROP FUNCTION IF EXISTS update_moment_stats();

CREATE OR REPLACE FUNCTION update_task_stats()
RETURNS TRIGGER AS $func$
BEGIN
    UPDATE tasks SET
        robot_execution_count = (
            SELECT COUNT(*) FROM robot_executions 
            WHERE task_id = NEW.task_id
        ),
        robot_success_count = (
            SELECT COUNT(*) FROM robot_executions 
            WHERE task_id = NEW.task_id AND success = TRUE
        ),
        average_execution_seconds = (
            SELECT AVG(duration_seconds) FROM robot_executions 
            WHERE task_id = NEW.task_id AND success = TRUE
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.task_id;
    
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_stats
AFTER INSERT ON robot_executions
FOR EACH ROW
EXECUTE FUNCTION update_task_stats();

DROP TRIGGER IF EXISTS trigger_moments_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Step 9: Update location_preferences table
-- Add temporary job_id column
ALTER TABLE location_preferences ADD COLUMN IF NOT EXISTS job_id_temp VARCHAR(255);

-- Copy old task_id (VARCHAR, referring to jobs) to job_id_temp
UPDATE location_preferences 
SET job_id_temp = task_id 
WHERE task_id IS NOT NULL;

-- Drop old task_id column (VARCHAR)
ALTER TABLE location_preferences DROP COLUMN IF EXISTS task_id;

-- Add new task_id as UUID
ALTER TABLE location_preferences ADD COLUMN IF NOT EXISTS task_id UUID;

-- Copy moment_id to new task_id
UPDATE location_preferences 
SET task_id = moment_id 
WHERE moment_id IS NOT NULL;

-- Drop moment_id column
ALTER TABLE location_preferences DROP COLUMN IF EXISTS moment_id;

-- Rename job_id_temp to job_id
ALTER TABLE location_preferences RENAME COLUMN job_id_temp TO job_id;

-- Drop existing foreign key constraints if any
ALTER TABLE location_preferences DROP CONSTRAINT IF EXISTS location_preferences_job_id_fkey;
ALTER TABLE location_preferences DROP CONSTRAINT IF EXISTS location_preferences_task_id_fkey;

-- Add foreign key constraints
ALTER TABLE location_preferences 
ADD CONSTRAINT location_preferences_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id);

ALTER TABLE location_preferences 
ADD CONSTRAINT location_preferences_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES tasks(id);

-- Step 10: Update robot_executions table
ALTER TABLE robot_executions RENAME COLUMN moment_id TO task_id;

-- Step 11: Update media table to reference jobs
ALTER TABLE media RENAME COLUMN task_id TO job_id;

-- Step 12: Create views (AFTER all migrations are complete)
CREATE VIEW tasks_enriched AS
SELECT 
    t.*,
    COUNT(DISTINCT tm.media_id) as media_count,
    ARRAY_AGG(DISTINCT med.media_type) FILTER (WHERE med.media_type IS NOT NULL) as available_media_types,
    l.name as location_name,
    j.title as job_title,
    EXISTS(
        SELECT 1 FROM location_preferences lp 
        WHERE lp.task_id = t.id
    ) as has_location_preference
FROM tasks t
LEFT JOIN task_media tm ON t.id = tm.task_id
LEFT JOIN media med ON tm.media_id = med.id
JOIN locations l ON t.location_id = l.id
JOIN jobs j ON t.job_id = j.id
GROUP BY t.id, l.name, j.title;

CREATE VIEW job_performance AS
SELECT 
    j.id as job_id,
    j.title as job_title,
    l.id as location_id,
    l.name as location_name,
    COUNT(DISTINCT t.id) as task_count,
    AVG(t.robot_success_rate) as avg_success_rate,
    SUM(t.robot_execution_count) as total_executions,
    MAX(t.updated_at) as last_updated
FROM jobs j
JOIN locations l ON j.location_id = l.id
LEFT JOIN tasks t ON j.id = t.job_id
GROUP BY j.id, j.title, l.id, l.name;

COMMIT;

-- Verification queries (run these to verify the migration)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('jobs', 'tasks', 'task_media');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'job_id';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'location_preferences' AND column_name IN ('job_id', 'task_id');
