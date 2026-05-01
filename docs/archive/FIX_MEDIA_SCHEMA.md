# Fix Media Table Schema

## Problem

Media sync is failing with error:
```
column "synced_at" of relation "media" does not exist
```

## Quick Fix (Recommended)

### Step 1: Go to Neon Console

1. Open [Neon Console](https://console.neon.tech/)
2. Select your project
3. Go to **SQL Editor**

### Step 2: Run This SQL

Copy and paste this into the SQL Editor:

```sql
-- Add missing synced_at column
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add other potentially missing columns
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

### Step 3: Verify Schema

Run this to check all columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media'
ORDER BY ordinal_position;
```

You should see:
- `synced_at` ✅
- `created_at` ✅
- `updated_at` ✅

### Step 4: Test Sync

1. Go back to Robot Intelligence page
2. Click **"Force Media Sync"** button
3. Should work now! ✅

## Full Schema Recreation (Only if needed)

If the table is completely broken, you can recreate it. **WARNING: This deletes all existing media records!**

See `database/migrations/fix-media-schema.sql` for the full recreation script.

## What I Fixed in Code

1. **Simplified syncMedia function** - Now tries full insert first, falls back to minimal insert if schema issues
2. **Better error handling** - Detects schema errors and provides helpful messages
3. **Migration script** - Created `database/migrations/fix-media-schema.sql` for easy schema fixes

## After Fixing Schema

Once you've run the ALTER TABLE commands in Neon:

1. ✅ Media sync will work
2. ✅ "Media Files" stat will update
3. ✅ Robot API can query media
4. ✅ Regular sync will maintain media

## Need Help?

If you can't access Neon Console right now, the code will automatically use a minimal insert (only required columns) which should work even without `synced_at`. However, it's better to fix the schema properly.

