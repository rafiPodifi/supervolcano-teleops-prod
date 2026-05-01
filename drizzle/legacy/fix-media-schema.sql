-- Migration: Fix media table schema
-- Run this in Neon Console → SQL Editor
-- This adds missing columns and ensures the table structure is correct

-- Step 1: Add missing synced_at column if it doesn't exist
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Add other potentially missing columns
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Verify all required columns exist
-- Check current schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'media'
ORDER BY ordinal_position;

-- If you need to recreate the table completely (WARNING: Deletes existing data):
-- Uncomment the following section only if the table structure is completely wrong

/*
-- WARNING: This will delete all existing media records!
DROP TABLE IF EXISTS task_media CASCADE;
DROP TABLE IF EXISTS media CASCADE;

-- Create media table with ALL required columns
CREATE TABLE media (
    id VARCHAR(255) PRIMARY KEY,
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
    
    -- Sync tracking (IMPORTANT: These were missing)
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_media_location ON media(location_id);
CREATE INDEX idx_media_job ON media(job_id);
CREATE INDEX idx_media_shift ON media(shift_id);
CREATE INDEX idx_media_type ON media(media_type);
CREATE INDEX idx_media_status ON media(processing_status);
CREATE INDEX idx_media_synced ON media(synced_at);

-- Task-Media junction table
CREATE TABLE task_media (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    media_id VARCHAR(255) NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    media_role VARCHAR(50) DEFAULT 'reference',
    time_offset_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, media_id)
);

CREATE INDEX idx_task_media_task ON task_media(task_id);
CREATE INDEX idx_task_media_media ON task_media(media_id);

-- Add trigger for updated_at
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
*/

