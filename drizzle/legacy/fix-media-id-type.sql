-- Migration: Fix media table id column type from UUID to VARCHAR
-- Firestore document IDs are alphanumeric strings, not UUIDs
-- Run this in Neon Console → SQL Editor

-- Step 1: Check current schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media' AND column_name = 'id';

-- Step 2: Check if there's any data (will be lost if we recreate)
SELECT COUNT(*) as media_count FROM media;

-- Step 3: Drop dependent tables first
DROP TABLE IF EXISTS task_media CASCADE;

-- Step 4: Drop and recreate media table with VARCHAR id
DROP TABLE IF EXISTS media CASCADE;

-- Step 5: Create media table with VARCHAR id (for Firestore IDs)
CREATE TABLE media (
    id VARCHAR(255) PRIMARY KEY,  -- ← Changed from UUID to VARCHAR for Firestore IDs
    organization_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255) NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    job_id VARCHAR(255) REFERENCES jobs(id) ON DELETE SET NULL,
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

-- Step 6: Create indexes
CREATE INDEX idx_media_location ON media(location_id);
CREATE INDEX idx_media_job ON media(job_id);
CREATE INDEX idx_media_shift ON media(shift_id);
CREATE INDEX idx_media_type ON media(media_type);
CREATE INDEX idx_media_status ON media(processing_status);
CREATE INDEX idx_media_synced ON media(synced_at);

-- Step 7: Recreate task_media junction table
-- First check tasks.id type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'id';

-- If tasks.id is UUID, we need to handle that
-- For now, assume tasks.id is already VARCHAR (or we'll fix it separately)
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

-- Step 8: Add updated_at trigger
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

-- Step 9: Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media' AND column_name = 'id';
-- Should show: id | character varying

