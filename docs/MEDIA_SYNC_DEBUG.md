# Media Sync Debugging Guide

## Problem

Media uploads successfully to Firestore but doesn't appear in Robot Intelligence stats after sync.

## Root Causes Fixed

1. ✅ **syncMedia function** - Improved with better error handling and logging
2. ✅ **syncAllData** - Already calls syncMedia, now with better logging
3. ✅ **Stats API** - Already includes media count, now with logging
4. ✅ **Media stat card** - Already displayed in UI

## What Was Fixed

### 1. Enhanced syncMedia Function
- Added detailed logging for each media file
- Better error messages showing which location/job is missing
- Handles organization_id lookup more safely
- Logs success/failure for each file

### 2. Improved syncAllData Logging
- Clear section headers: `[1/4]`, `[2/4]`, `[3/4]`, `[4/4]`
- Shows progress: "Synced X/Y media files"
- Lists all errors at the end
- Better summary output

### 3. Test Endpoint Created
- `/api/admin/test-media-sync` - Debug media sync directly
- Shows detailed results for each media file
- Lists all errors with context

## Testing Procedure

### Step 1: Test Media Sync Directly

Visit (with auth token):
```
GET /api/admin/test-media-sync
```

This will:
- List all media in Firestore
- Try to sync each one
- Show detailed results
- Report any errors

### Step 2: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Click "Sync from Firestore" in Robot Intelligence page
3. Watch real-time logs
4. Look for:
   - `[4/4] Syncing media files...`
   - `Found X media files in Firestore`
   - `[sync] Syncing media [id]: [filename]`
   - `✓ Synced X/Y media files`

### Step 3: Check Neon Database

Run in Neon Console:

```sql
-- Should show count matching Firestore
SELECT COUNT(*) as media_count FROM media;

-- Should show your uploaded videos
SELECT 
  id, 
  media_type, 
  storage_url, 
  location_id, 
  job_id,
  uploaded_at
FROM media 
ORDER BY uploaded_at DESC
LIMIT 10;

-- Check for missing locations
SELECT DISTINCT location_id 
FROM media 
WHERE location_id NOT IN (SELECT id FROM locations);
```

### Step 4: Verify Stats API

Check the stats endpoint returns media count:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-project.vercel.app/api/admin/robot-intelligence/stats
```

Should return:
```json
{
  "locations": 6,
  "shifts": 0,
  "tasks": 0,
  "executions": 0,
  "media": 2  // ← Should match Firestore count
}
```

## Common Issues

### Issue 1: "Location not found in SQL"

**Symptom:** Media sync fails with "Location not found in SQL"

**Fix:** Sync locations first, then media:
1. Click "Sync from Firestore"
2. Wait for locations to sync
3. Click "Sync from Firestore" again (media will sync)

**Why:** Media needs locations to exist in SQL to get organization_id.

### Issue 2: Media Count Still Shows 0

**Possible Causes:**
1. Media table doesn't exist in SQL
2. Foreign key constraint failing silently
3. Stats API not querying correctly

**Debug:**
1. Check Neon Console: `SELECT COUNT(*) FROM media;`
2. If 0, check Vercel logs for sync errors
3. Use test endpoint: `/api/admin/test-media-sync`

### Issue 3: Foreign Key Constraint Errors

**Symptom:** Media sync fails silently

**Fix:** Ensure locations and jobs are synced first:
1. Sync locations
2. Sync jobs
3. Then sync media

## Expected Results

### Before Fix:
```
Media Files: 0 ❌
```

### After Fix:
```
Media Files: 2 ✅
(or however many you uploaded)
```

### Vercel Logs Should Show:
```
[4/4] Syncing media files...
Found 2 media files in Firestore
[sync] Syncing media abc123: video.mp4
[sync]   - Location: location-123
[sync]   - Job: job-456
[sync]   - Type: video
[sync]   - URL: present
[sync]   - Organization: org-789
[sync] ✓ Successfully synced media abc123
✓ Synced 2/2 media files
```

## Success Criteria

✅ syncMedia function exists and works
✅ syncAllData calls syncMedia
✅ Media syncs from Firestore to SQL
✅ "Media Files" stat shows correct count
✅ No foreign key constraint errors
✅ Detailed logging shows what's happening
✅ Test endpoint confirms sync works
✅ Robot API can query media

## Next Steps

1. **Test the sync:**
   - Click "Sync from Firestore" in Robot Intelligence
   - Check Vercel logs
   - Verify media count updates

2. **If still 0:**
   - Use test endpoint: `/api/admin/test-media-sync`
   - Check Neon database directly
   - Review error messages in logs

3. **If errors:**
   - Ensure locations are synced first
   - Check that media has valid locationId in Firestore
   - Verify media table exists in SQL

