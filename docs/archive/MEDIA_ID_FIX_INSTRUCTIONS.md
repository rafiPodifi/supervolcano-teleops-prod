# Fix Media Table ID Type - Quick Instructions

## The Problem

Media sync is failing with:
```
invalid input syntax for type uuid: "EqEz1dI0HelzRuncG3Pm"
```

**Root Cause:** The `media` table's `id` column is `UUID` type, but Firestore document IDs are alphanumeric strings.

## The Fix

### Step 1: Go to Neon Console

1. Open [Neon Console](https://console.neon.tech/)
2. Select your project
3. Go to **SQL Editor**

### Step 2: Run This SQL

**⚠️ WARNING: This will delete existing media records!**

Copy and paste the entire contents of:
```
database/migrations/fix-media-id-standalone.sql
```

Or copy this directly:

```sql
-- Drop dependent tables first
DROP TABLE IF EXISTS task_media CASCADE;
DROP TABLE IF EXISTS moment_media CASCADE;

-- Drop and recreate media table
DROP TABLE IF EXISTS media CASCADE;

-- Create media table with VARCHAR id (for Firestore IDs)
CREATE TABLE media (
    id VARCHAR(255) PRIMARY KEY,  -- ← VARCHAR instead of UUID
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

-- Create indexes
CREATE INDEX idx_media_location ON media(location_id);
CREATE INDEX idx_media_job ON media(job_id);
CREATE INDEX idx_media_shift ON media(shift_id);
CREATE INDEX idx_media_type ON media(media_type);
CREATE INDEX idx_media_status ON media(processing_status);
CREATE INDEX idx_media_synced ON media(synced_at);

-- Recreate task_media junction table
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

-- Add updated_at trigger
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
```

### Step 3: Verify

Run this to confirm the fix:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media' AND column_name = 'id';
```

**Expected result:** `id | character varying` (not `uuid`)

### Step 4: Test

1. Go back to Robot Intelligence page (`/admin/robot-intelligence`)
2. Click **"Force Media Sync"** button
3. Should work now! ✅

## Success Criteria

✅ Media table `id` column is `VARCHAR(255)`  
✅ No UUID type errors  
✅ Force Media Sync succeeds  
✅ "Media Files: 1" in stats  
✅ SQL has media record with Firestore ID  

## Files Updated

- `database/schema.sql` - Updated media table definition
- `database/migrations/fix-media-id-standalone.sql` - Standalone migration script
- `FIX_MEDIA_ID_TYPE.md` - Detailed documentation

