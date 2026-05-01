# Fix Media Table ID Column Type

## Problem

Media sync is failing with error:
```
invalid input syntax for type uuid: "EqEz1dI0HelzRuncG3Pm"
```

## Root Cause

The `media` table's `id` column is set to `UUID` type, but Firestore document IDs are alphanumeric strings (not UUID format).

**Firestore IDs:** `"EqEz1dI0HelzRuncG3Pm"` (alphanumeric string)  
**UUID format:** `"550e8400-e29b-41d4-a716-446655440000"` (hyphenated hex)

## Quick Fix

### Step 1: Go to Neon Console

1. Open [Neon Console](https://console.neon.tech/)
2. Select your project
3. Go to **SQL Editor**

### Step 2: Run This SQL

**⚠️ WARNING: This will delete existing media records!**

Copy and paste this into the SQL Editor:

```sql
-- Drop dependent tables first
DROP TABLE IF EXISTS task_media CASCADE;

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

### Step 3: Verify the Fix

Run this to confirm the id column is now VARCHAR:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media' AND column_name = 'id';
```

**Expected result:** `id | character varying` (not `uuid`)

### Step 4: Test Sync

1. Go back to Robot Intelligence page
2. Click **"Force Media Sync"** button
3. Should work now! ✅

## Check Tasks Table Too

If you get errors about `task_id` in `task_media`, check if `tasks.id` is also UUID:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'id';
```

If `tasks.id` is UUID but should be VARCHAR (for Firestore IDs), you'll need to fix that too. But for now, the media table fix should resolve the immediate issue.

## After Fixing

Once the schema is fixed:
- ✅ Media sync will work
- ✅ "Media Files" stat will update
- ✅ Robot API can query media
- ✅ Regular sync will maintain media

## Full Migration Script

See `database/migrations/fix-media-id-type.sql` for the complete migration script with comments.

