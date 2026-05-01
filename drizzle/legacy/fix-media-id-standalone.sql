-- ============================================
-- QUICK FIX: Change media.id from UUID to VARCHAR
-- ============================================
-- This fixes the error: "invalid input syntax for type uuid: 'EqEz1dI0HelzRuncG3Pm'"
-- 
-- Run this in Neon Console → SQL Editor
-- ============================================

-- Step 1: Drop dependent tables first
DROP TABLE IF EXISTS task_media CASCADE;
DROP TABLE IF EXISTS moment_media CASCADE;  -- In case old name exists

-- Step 2: Drop and recreate media table with VARCHAR id
DROP TABLE IF EXISTS media CASCADE;

-- Step 3: Create media table with VARCHAR id (for Firestore IDs)
CREATE TABLE media (
    id VARCHAR(255) PRIMARY KEY,  -- ← Changed from UUID to VARCHAR
    organization_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255) NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    job_id VARCHAR(255) REFERENCES jobs(id) ON DELETE SET NULL,  -- If jobs table exists
    shift_id VARCHAR(255) REFERENCES shifts(id) ON DELETE SET NULL,
    
    -- Media info
    media_type VARCHAR(50) NOT NULL DEFAULT 'video',
    storage_url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- Technical details
    duration_seconds INTEGER,
    resolution VARCHAR(50),
    fps INTEGER,
    
    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'completed',
    ai_processed BOOLEAN DEFAULT FALSE,
    moments_extracted INTEGER DEFAULT 0,
    
    -- Metadata
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'admin',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT[] DEFAULT '{}',
    
    -- Tracking
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create indexes
CREATE INDEX idx_media_location ON media(location_id);
CREATE INDEX idx_media_job ON media(job_id);
CREATE INDEX idx_media_shift ON media(shift_id);
CREATE INDEX idx_media_type ON media(media_type);
CREATE INDEX idx_media_status ON media(processing_status);
CREATE INDEX idx_media_synced ON media(synced_at);

-- Step 5: Recreate task_media junction table (if tasks table exists)
-- Note: Adjust task_id type based on your tasks table
CREATE TABLE task_media (
    task_id VARCHAR(255) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    media_id VARCHAR(255) NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    media_role VARCHAR(50) DEFAULT 'reference',
    time_offset_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, media_id)
);

CREATE INDEX idx_task_media_task ON task_media(task_id);
CREATE INDEX idx_task_media_media ON task_media(media_id);

-- Step 6: Add updated_at trigger
CREATE OR REPLACE FUNCTION update_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_media_updated_at
BEFORE UPDATE ON media
FOR EACH ROW
EXECUTE FUNCTION update_media_updated_at();

-- Step 7: Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media' AND column_name = 'id';
-- Expected: id | character varying

-- ✅ Done! Now try "Force Media Sync" in Robot Intelligence page

