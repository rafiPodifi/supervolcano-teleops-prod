-- Phase 1: Create training_videos table standalone.
-- Stripped from drizzle/legacy/002_video_intelligence.sql:
--   * dropped ALTER TABLE media (table not yet created on staging)
--   * dropped FK source_media_id REFERENCES media(id) (kept column as plain VARCHAR)
--   * dropped video_processing_queue + media_enriched view (both depend on media)
-- Apply via Cloud SQL Studio (Console -> SQL -> sv-sql-staging -> Cloud SQL Studio).

CREATE TABLE IF NOT EXISTS training_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to source media (no FK yet; media table not provisioned)
  source_media_id VARCHAR(255),

  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,

  room_type VARCHAR(50),
  action_types TEXT[] DEFAULT '{}',
  object_labels TEXT[] DEFAULT '{}',
  technique_tags TEXT[] DEFAULT '{}',

  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_room_type    ON training_videos(room_type);
CREATE INDEX IF NOT EXISTS idx_training_action_types ON training_videos USING GIN (action_types);
CREATE INDEX IF NOT EXISTS idx_training_object_labels ON training_videos USING GIN (object_labels);
CREATE INDEX IF NOT EXISTS idx_training_technique_tags ON training_videos USING GIN (technique_tags);
CREATE INDEX IF NOT EXISTS idx_training_featured     ON training_videos(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_training_quality      ON training_videos(quality_score DESC);

CREATE OR REPLACE FUNCTION update_training_videos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS training_videos_updated ON training_videos;
CREATE TRIGGER training_videos_updated
  BEFORE UPDATE ON training_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_training_videos_timestamp();

-- Verify
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
