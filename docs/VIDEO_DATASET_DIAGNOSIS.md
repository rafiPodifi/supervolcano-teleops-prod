# Video Dataset Diagnosis: Media Library vs Contributions

## Problem Summary

Two admin pages show different video datasets:
- **Media Library**: Shows 37 videos (filenames like `1765331066803.mov`)
- **Contributions**: Shows 8 videos (filenames like `IMG_0481.MOV`)
- **Issue**: Contribution videos do NOT appear in Media Library

---

## 1. Collection Names

Both pages query the **same Firestore collection**: `media`

### Media Library
- **Page**: `src/app/admin/robot-intelligence/media/page.tsx`
- **API Route**: `src/app/api/admin/videos/route.ts`
- **Collection**: `media`
- **Query**: 
  ```typescript
  adminDb.collection('media')
  // Optional: .where('locationId', '==', locationId)
  // Optional: .orderBy('uploadedAt', 'desc')
  ```

### Contributions
- **Page**: `src/app/admin/contributions/page.tsx`
- **Query**: Direct Firestore client query
- **Collection**: `media`
- **Query**:
  ```typescript
  query(
    collection(db, 'media'),
    where('source', '==', 'web_contribute'),
    orderBy('createdAt', 'desc')
  )
  ```

---

## 2. Query Filters

### Media Library (`/api/admin/videos`)

**Filters Applied:**
1. **Location Filter** (optional): `where('locationId', '==', locationId)`
2. **Video Type Filter**: Uses `isVideo()` helper function to filter documents
3. **AI Status Filter** (optional): Filters by `aiStatus` (pending/processing/completed/failed)

**`isVideo()` Function Logic:**
```typescript
function isVideo(document: FirebaseFirestore.DocumentData): boolean {
  const type = document.type || document.mediaType || '';
  const mimeType = document.mimeType || document.contentType || '';
  const fileName = document.fileName || document.name || '';
  const videoUrl = document.videoUrl || document.url || document.storageUrl || '';
  const storagePath = document.storagePath || '';

  // Returns true if ANY of these conditions match:
  // 1. type === 'video' || type === 'VIDEO'
  // 2. mimeType starts with 'video/'
  // 3. fileName ends with video extension (.mp4, .mov, .avi, .mkv, .webm, .m4v)
  // 4. videoUrl contains video extension
  // 5. storagePath starts with 'videos/' OR ends with video extension
}
```

**No Filter On:**
- `source` field (shows ALL sources)
- `reviewStatus` field
- `organizationId` field

### Contributions (`/admin/contributions`)

**Filters Applied:**
1. **Source Filter** (required): `where('source', '==', 'web_contribute')`
2. **Review Status Filter** (optional): `where('reviewStatus', '==', statusFilter)` when statusFilter !== 'all'
3. **Order By**: `orderBy('createdAt', 'desc')`

**No Filter On:**
- Video type (relies on Firestore data structure)
- Location
- Organization

---

## 3. Schema Differences

### Media Library Videos (37 videos)
**Expected Schema:**
```typescript
{
  id: string;
  type?: 'video' | 'image';
  mediaType?: 'video' | 'image';
  mimeType?: string;  // e.g., 'video/mp4'
  fileName?: string;  // e.g., '1765331066803.mov'
  videoUrl?: string;
  url?: string;
  storageUrl?: string;
  storagePath?: string;  // e.g., 'videos/{locationId}/{userId}/{filename}'
  locationId?: string;
  uploadedAt?: Timestamp;
  aiStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  trainingStatus?: 'pending' | 'approved' | 'rejected';
  // ... AI annotation fields
}
```

**Source Values:**
- `mobile_app` (from mobile app uploads)
- `web_owner` (from owner uploads)
- `web_onboarding` (from onboarding flow)
- `oem_upload` (from OEM partner uploads)
- **Missing**: `web_contribute` (contributor uploads)

### Contributions Videos (8 videos)
**Expected Schema:**
```typescript
{
  id: string;
  source: 'web_contribute';  // REQUIRED - this is the key difference
  fileName: string;  // e.g., 'IMG_0481.MOV'
  fileSize: number;
  durationSeconds?: number;
  url: string;
  storagePath: string;
  locationText?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  contributorId: string;
  contributorEmail: string;
  contributorName?: string;
  createdAt: Timestamp;
  // Blur fields
  blurStatus?: 'none' | 'processing' | 'complete' | 'failed';
  blurredUrl?: string;
  // ... other contributor-specific fields
}
```

**Key Differences:**
1. **`source` field**: Contributions videos have `source: 'web_contribute'`, Media Library doesn't filter by source
2. **Field names**: Contributions may use different field names (e.g., `createdAt` vs `uploadedAt`)
3. **Missing fields**: Contribution videos might not have `type`, `mediaType`, or `mimeType` fields that `isVideo()` checks

---

## 4. Why Contribution Videos Don't Appear in Media Library

### Root Cause Analysis

The Media Library's `isVideo()` function may be **failing to identify contribution videos** because:

1. **Missing `type` or `mediaType` fields**: Contribution videos might not have these fields set
2. **Missing `mimeType` field**: If `mimeType` is not set, the function relies on `fileName` or `storagePath`
3. **Different field naming**: Contribution videos use `createdAt` instead of `uploadedAt`
4. **Storage path format**: Contribution videos might have different `storagePath` format that doesn't match the `videos/` prefix check

### Most Likely Issue

**Contributor videos are likely missing the `type`, `mediaType`, or `mimeType` fields**, causing `isVideo()` to return `false` even though they are videos.

The `isVideo()` function should still work if:
- `fileName` ends with `.MOV` (which it does: `IMG_0481.MOV`)
- OR `storagePath` contains the file extension
- OR `url` contains the file extension

**However**, if the contribution videos have:
- `fileName` that doesn't match (unlikely, since we see `IMG_0481.MOV`)
- `storagePath` that doesn't match the pattern
- `url` that doesn't contain the extension

Then `isVideo()` would return `false`.

---

## 5. Recommended Fix

### Option 1: Update `isVideo()` to Handle Contribution Videos (Recommended)

Modify the `isVideo()` function in `/api/admin/videos/route.ts` to be more lenient:

```typescript
function isVideo(document: FirebaseFirestore.DocumentData): boolean {
  const type = document.type || document.mediaType || '';
  const mimeType = document.mimeType || document.contentType || '';
  const fileName = document.fileName || document.name || '';
  const videoUrl = document.videoUrl || document.url || document.storageUrl || '';
  const storagePath = document.storagePath || '';

  // Check explicit type fields
  if (type === 'video' || type === 'VIDEO') return true;
  if (mimeType?.startsWith?.('video/')) return true;
  
  // Check file extension in fileName (case-insensitive)
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerFileName = fileName.toLowerCase();
  if (videoExtensions.some(ext => lowerFileName.endsWith(ext))) return true;

  // Check URL for video extension (for mobile uploads without mediaType)
  const lowerUrl = videoUrl.toLowerCase();
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) return true;

  // Check storagePath for video extension or videos folder
  const lowerPath = storagePath.toLowerCase();
  if (lowerPath.startsWith('videos/') || videoExtensions.some(ext => lowerPath.endsWith(ext))) return true;

  // NEW: If source is 'web_contribute' and has url/storagePath, assume it's a video
  // (Contributor uploads are always videos)
  if (document.source === 'web_contribute' && (url || storagePath)) {
    return true;
  }

  return false;
}
```

### Option 2: Add Source Filter to Media Library Query

Add an optional filter to include contribution videos:

```typescript
// In /api/admin/videos/route.ts
let query: FirebaseFirestore.Query = adminDb.collection('media');

// Optionally exclude certain sources, or include all
const excludeSources = searchParams.get('excludeSources')?.split(',') || [];
if (excludeSources.length > 0) {
  // This would require a different query structure
  // Firestore doesn't support NOT IN directly
}
```

### Option 3: Normalize Contribution Video Schema

When contributor videos are created, ensure they have the same fields as other videos:

```typescript
// In contributor upload flow, ensure these fields are set:
{
  source: 'web_contribute',
  type: 'video',  // ADD THIS
  mediaType: 'video',  // ADD THIS
  mimeType: 'video/quicktime',  // ADD THIS (for .MOV files)
  fileName: 'IMG_0481.MOV',
  // ... rest of fields
}
```

---

## 6. Verification Steps

1. **Check a contribution video document in Firestore:**
   ```javascript
   // In Firebase Console or via API
   const doc = await adminDb.collection('media').doc('CONTRIBUTION_VIDEO_ID').get();
   console.log(doc.data());
   ```

2. **Verify which fields are missing:**
   - Does it have `type` or `mediaType`?
   - Does it have `mimeType`?
   - Does `fileName` end with `.MOV`?
   - Does `storagePath` contain the file extension?

3. **Test `isVideo()` function:**
   ```typescript
   const contributionDoc = await adminDb.collection('media')
     .where('source', '==', 'web_contribute')
     .limit(1)
     .get();
   
   const data = contributionDoc.docs[0].data();
   console.log('isVideo result:', isVideo(data));
   console.log('Document data:', data);
   ```

---

## 7. Summary

| Aspect | Media Library | Contributions |
|--------|--------------|--------------|
| **Collection** | `media` | `media` |
| **Source Filter** | None (shows all) | `source == 'web_contribute'` |
| **Video Detection** | `isVideo()` helper function | Assumes all are videos |
| **Field Requirements** | Requires `type`/`mediaType`/`mimeType` or file extension match | Only requires `source` field |
| **Order By** | `uploadedAt` | `createdAt` |
| **Count** | 37 videos | 8 videos |

**Root Cause**: Contribution videos likely don't pass the `isVideo()` check because they're missing `type`, `mediaType`, or `mimeType` fields, or their `storagePath`/`url` doesn't match the expected patterns.

**Recommended Fix**: Update `isVideo()` function to handle `source: 'web_contribute'` videos, or normalize the contributor upload schema to include required fields.

