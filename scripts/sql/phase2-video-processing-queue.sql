-- Phase 2: Create video_processing_queue table standalone.
-- Backs the AI analyze pipeline (src/lib/services/video-intelligence/processing-pipeline.service.ts).
-- Stripped from drizzle/legacy/002_video_intelligence.sql:
--   * dropped FK media_id REFERENCES media(id) (media table not provisioned on staging)
--   * kept media_id as plain VARCHAR(255) (Firestore doc IDs)
-- Apply via Cloud SQL Studio (Console -> SQL -> sv-sql-staging -> Cloud SQL Studio).

CREATE TABLE IF NOT EXISTS video_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  UNIQUE(media_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_status_priority
  ON video_processing_queue(status, priority DESC, queued_at ASC);

-- Verify
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
