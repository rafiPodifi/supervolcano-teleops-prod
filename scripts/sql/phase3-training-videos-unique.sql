-- Phase 3: Add UNIQUE constraint on training_videos.source_media_id.
-- Pipeline uses `INSERT ... ON CONFLICT (source_media_id) DO UPDATE` in
-- processing-pipeline.service.ts (syncToTrainingCorpus). Without a unique
-- constraint, Postgres returns:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- Apply via Cloud SQL Studio on sv-sql-staging and sv-sql-prod.

-- De-dupe any existing rows first (keep newest by created_at). On a fresh
-- table this is a no-op.
DELETE FROM training_videos a USING training_videos b
WHERE a.source_media_id = b.source_media_id
  AND a.source_media_id IS NOT NULL
  AND a.created_at < b.created_at;

ALTER TABLE training_videos
  ADD CONSTRAINT training_videos_source_media_id_key UNIQUE (source_media_id);

-- Verify
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'training_videos'::regclass;
