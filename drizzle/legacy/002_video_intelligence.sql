-- ============================================
-- VIDEO INTELLIGENCE SCHEMA MIGRATION
-- Run after existing schema.sql
-- ============================================

-- --------------------------------------------
-- 1. Update existing media table
-- --------------------------------------------

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) DEFAULT 'pending'
  CHECK (ai_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS ai_annotations JSONB;

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP;

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS ai_error TEXT;

ALTER TABLE media
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE media
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

ALTER TABLE media
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);

-- Index for querying by AI status
CREATE INDEX IF NOT EXISTS idx_media_ai_status ON media(ai_status);

-- Index for JSONB label queries
CREATE INDEX IF NOT EXISTS idx_media_ai_labels ON media USING GIN ((ai_annotations->'labels'));

-- --------------------------------------------
-- 2. Create training_videos table (anonymized)
-- --------------------------------------------

CREATE TABLE IF NOT EXISTS training_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to source (internal use only, not exposed to OEMs)
  source_media_id VARCHAR(255) REFERENCES media(id) ON DELETE SET NULL,
  
  -- Video access
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  
  -- Coarse labels (room/space type)
  room_type VARCHAR(50), -- kitchen, bathroom, bedroom, living_room, garage, outdoor, etc.
  
  -- Action classification
  action_types TEXT[] DEFAULT '{}', -- cleaning, organizing, inspecting, etc.
  
  -- Objects detected (from AI)
  object_labels TEXT[] DEFAULT '{}', -- sponge, spray_bottle, mop, vacuum, etc.
  
  -- Technique tags (human-curated or AI-suggested)
  technique_tags TEXT[] DEFAULT '{}', -- countertop_wipe, floor_mop, glass_clean, etc.
  
  -- Quality metrics
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  
  -- IMPORTANT: NO location_id, NO session_id, NO PII
);

-- Indexes for training queries
CREATE INDEX IF NOT EXISTS idx_training_room_type ON training_videos(room_type);
CREATE INDEX IF NOT EXISTS idx_training_action_types ON training_videos USING GIN (action_types);
CREATE INDEX IF NOT EXISTS idx_training_object_labels ON training_videos USING GIN (object_labels);
CREATE INDEX IF NOT EXISTS idx_training_technique_tags ON training_videos USING GIN (technique_tags);
CREATE INDEX IF NOT EXISTS idx_training_featured ON training_videos(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_training_quality ON training_videos(quality_score DESC);

-- --------------------------------------------
-- 3. Create processing_queue table
-- --------------------------------------------

CREATE TABLE IF NOT EXISTS video_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id VARCHAR(255) REFERENCES media(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0, -- Higher = process first
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

-- --------------------------------------------
-- 4. Create views for easy querying
-- --------------------------------------------

-- View: Media with AI annotations enriched
CREATE OR REPLACE VIEW media_enriched AS
SELECT 
  m.*,
  l.name as location_name,
  l.address as location_address,
  s.shift_date,
  COALESCE(
    (SELECT array_agg(label->>'description') 
     FROM jsonb_array_elements(m.ai_annotations->'labels') as label
     WHERE (label->>'confidence')::float > 0.7),
    '{}'::text[]
  ) as top_labels,
  COALESCE(
    (SELECT array_agg(obj->>'description')
     FROM jsonb_array_elements(m.ai_annotations->'objects') as obj),
    '{}'::text[]
  ) as detected_objects
FROM media m
LEFT JOIN locations l ON m.location_id = l.id
LEFT JOIN shifts s ON m.shift_id = s.id;

-- View: Training corpus statistics
CREATE OR REPLACE VIEW training_stats AS
SELECT 
  room_type,
  COUNT(*) as video_count,
  AVG(duration_seconds) as avg_duration,
  AVG(quality_score) as avg_quality,
  array_agg(DISTINCT unnest_actions) as all_actions,
  array_agg(DISTINCT unnest_objects) as all_objects
FROM training_videos,
  LATERAL unnest(action_types) as unnest_actions,
  LATERAL unnest(object_labels) as unnest_objects
GROUP BY room_type;

-- --------------------------------------------
-- 5. Functions
-- --------------------------------------------

-- Function: Update timestamp trigger
CREATE OR REPLACE FUNCTION update_training_videos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_videos_updated
  BEFORE UPDATE ON training_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_training_videos_timestamp();

-- Function: Increment view count
CREATE OR REPLACE FUNCTION increment_training_view(video_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE training_videos 
  SET view_count = view_count + 1 
  WHERE id = video_id;
END;
$$ LANGUAGE plpgsql;

