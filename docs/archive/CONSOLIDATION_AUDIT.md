# Video Management Pages Consolidation Audit

## Overview

Two separate admin pages manage videos with overlapping but distinct functionality:
- **Contributions** (`src/app/admin/contributions/page.tsx`) - Contributor upload review workflow
- **Media Library** (`src/app/admin/robot-intelligence/media/page.tsx`) - AI processing and training corpus workflow

---

## 1. Feature Matrix

| Feature | Contributions | Media Library | Notes |
|---------|--------------|---------------|-------|
| **Video Upload/Import** | ✅ | ❌ | Contributions has direct upload + Google Drive import |
| **Face Blur Processing** | ✅ | ❌ | Contributions only - uses Video Intelligence API |
| **Re-blur Action** | ✅ | ❌ | Contributions only - allows re-processing blurred videos |
| **Blur Status Tracking** | ✅ | ❌ | Contributions tracks: none/processing/complete/failed |
| **Blurred Video Download** | ✅ | ❌ | Contributions can download blurred or original |
| **Review Workflow (Approve/Reject)** | ✅ | ❌ | Contributions: Pending → Approved/Rejected |
| **AI Processing (CV Labels)** | ❌ | ✅ | Media Library: Queued → Processing → Completed/Failed |
| **Training Corpus Approval** | ❌ | ✅ | Media Library: Pending Review → Approved/Rejected |
| **Batch Processing** | ❌ | ✅ | Media Library: Process multiple videos for AI analysis |
| **Re-analyze Video** | ❌ | ✅ | Media Library: Re-run AI analysis on completed videos |
| **Video Preview/Playback** | ✅ | ✅ | Both have modal preview with video player |
| **Bulk Actions** | ✅ | ✅ | Both support multi-select and bulk operations |
| **Bulk Delete** | ❌ | ✅ | Media Library only |
| **Export to Partner** | ✅ | ❌ | Contributions: Create ZIP/manifest exports |
| **Table View** | ✅ | ✅ | Both have table layout |
| **Gallery View** | ✅ | ❌ | Contributions only |
| **Search/Filter** | ✅ | ✅ | Both have filtering capabilities |
| **Contributor Stats** | ✅ | ❌ | Contributions tracks per-contributor metrics |
| **Location Info** | ✅ | ✅ | Both show location data |
| **Refresh Data** | ❌ | ✅ | Media Library has explicit refresh button |
| **Keyboard Shortcuts** | ❌ | ✅ | Media Library: Arrow keys, A/R for approve/reject, Del for delete |

---

## 2. API Routes Used

### Contributions Page

| API Route | Method | Purpose | Used By |
|-----------|--------|---------|---------|
| `/api/admin/contributions/blur` | POST | Trigger face blur processing | `handleBlur()` |
| `/api/admin/contributions/download` | GET | Get signed download URL (blurred/original) | `handleDownload()` |
| `/api/admin/contributions/export` | POST | Create bulk export (ZIP/manifest) | `handleCreateExport()` |
| `/api/admin/drive/auth` | GET/POST | Google Drive OAuth flow | `handleDriveConnect()` |
| `/api/admin/drive/list` | POST | List videos in Drive folder | `handleDriveListFiles()` |
| `/api/admin/drive/import` | POST | Import videos from Drive | `handleDriveImport()` |
| Firestore Client SDK | Direct | Real-time updates, approve/reject | `handleApprove()`, `handleReject()` |

### Media Library Page

| API Route | Method | Purpose | Used By |
|-----------|--------|---------|---------|
| `/api/admin/videos` | GET | List all videos with filters | `fetchMedia()` |
| `/api/admin/videos/process` | POST | Trigger AI analysis (single/batch/reanalyze) | `handleAnalyze()`, `processBatch()`, `handleReanalyze()` |
| `/api/admin/videos/approve-training` | POST | Approve/reject for training corpus | `handleSingleAction()`, `handleBulkAction()` |
| `/api/admin/videos/{mediaId}` | DELETE | Delete single video | `handleSingleDelete()` |
| `/api/admin/videos/bulk-delete` | POST | Delete multiple videos | `handleBulkDelete()` |

---

## 3. Data Schema Differences

### Contributions Videos
```typescript
{
  source: 'web_contribute',
  reviewStatus: 'pending' | 'approved' | 'rejected',
  blurStatus: 'none' | 'processing' | 'complete' | 'failed',
  blurredUrl?: string,
  blurredStoragePath?: string,
  facesDetected?: number,
  contributorId: string,
  contributorEmail: string,
  contributorName?: string,
  locationText?: string,
  rejectionReason?: string,
  reviewedAt?: Timestamp,
  reviewedBy?: string,
  createdAt: Timestamp
}
```

### Media Library Videos
```typescript
{
  source: 'mobile_app' | 'web_owner' | 'web_onboarding' | 'oem_upload',
  aiStatus: 'pending' | 'processing' | 'completed' | 'failed',
  trainingStatus: 'pending' | 'approved' | 'rejected',
  aiAnnotations?: object,
  aiRoomType?: string,
  aiActionTypes?: string[],
  aiObjectLabels?: string[],
  aiQualityScore?: number,
  aiError?: string,
  uploadedAt: Timestamp
}
```

**Key Differences:**
- Contributions uses `reviewStatus` for approval workflow
- Media Library uses `trainingStatus` for training corpus approval
- Contributions has blur-specific fields
- Media Library has AI analysis fields
- Different timestamp fields: `createdAt` vs `uploadedAt`

---

## 4. Recommended Unified Workflow

### Proposed Pipeline: Upload → Face Blur → CV Label → Training Approval

```
┌─────────┐
│ Upload  │ (Contributor, Admin, Mobile, Drive)
└────┬────┘
     │
     ▼
┌─────────────┐
│ Face Blur   │ (Optional, for privacy-sensitive videos)
└────┬────────┘
     │
     ▼
┌─────────────┐
│ CV Label    │ (AI Analysis: room type, actions, objects, quality)
└────┬────────┘
     │
     ▼
┌──────────────────┐
│ Training Approval│ (Approve for training corpus)
└──────────────────┘
```

### Unified Status Model

```typescript
{
  // Upload status
  uploadStatus: 'uploading' | 'completed' | 'failed',
  
  // Privacy processing
  blurStatus: 'none' | 'processing' | 'complete' | 'failed',
  blurredUrl?: string,
  facesDetected?: number,
  
  // AI processing
  aiStatus: 'pending' | 'processing' | 'completed' | 'failed',
  aiAnnotations?: object,
  aiRoomType?: string,
  aiActionTypes?: string[],
  aiObjectLabels?: string[],
  aiQualityScore?: number,
  
  // Training corpus
  trainingStatus: 'pending' | 'approved' | 'rejected',
  
  // Review (for contributor uploads)
  reviewStatus?: 'pending' | 'approved' | 'rejected', // Optional, only for contributor uploads
}
```

### Workflow States

1. **New Upload** → `uploadStatus: 'completed'`, `blurStatus: 'none'`, `aiStatus: 'pending'`, `trainingStatus: 'pending'`
2. **Face Blur (if needed)** → `blurStatus: 'processing'` → `blurStatus: 'complete'`
3. **AI Analysis** → `aiStatus: 'processing'` → `aiStatus: 'completed'`
4. **Training Approval** → `trainingStatus: 'approved'` or `'rejected'`

**For Contributor Uploads:**
- Add `reviewStatus: 'pending'` after upload
- Admin approves → `reviewStatus: 'approved'`
- Then proceed to blur → AI → training workflow

---

## 5. Conflicts and UX Decisions Needed

### Conflict 1: Two Approval Workflows
- **Contributions**: `reviewStatus` (approve contributor uploads)
- **Media Library**: `trainingStatus` (approve for training corpus)

**Decision Needed:**
- Keep separate workflows? (Contributor review vs Training approval)
- Or merge into single approval? (Approve → auto-add to training)

**Recommendation:** Keep separate but sequential:
1. Contributor review (`reviewStatus`) - Quality check
2. Training approval (`trainingStatus`) - After AI analysis

### Conflict 2: Face Blur Location
- Currently only in Contributions page
- Should blur be available in Media Library?

**Decision Needed:**
- Add blur to Media Library?
- Or keep blur only for contributor uploads?

**Recommendation:** Add blur to Media Library for all videos, but make it optional. Contributor uploads can auto-trigger blur.

### Conflict 3: Video Import
- Contributions has upload/import features
- Media Library has no import

**Decision Needed:**
- Add import to Media Library?
- Or keep import only in Contributions?

**Recommendation:** Add import to Media Library, but route contributor uploads through Contributions page for proper attribution.

### Conflict 4: Export Functionality
- Contributions has export (ZIP/manifest)
- Media Library has no export

**Decision Needed:**
- Add export to Media Library?
- Or keep export only in Contributions?

**Recommendation:** Add export to Media Library for training data exports. Keep Contributions export for partner delivery.

### Conflict 5: View Modes
- Contributions: Table + Gallery
- Media Library: Table only

**Decision Needed:**
- Add gallery view to Media Library?
- Or standardize on table view?

**Recommendation:** Add gallery view to Media Library for consistency.

### Conflict 6: Data Source
- Contributions: Real-time Firestore listener (`onSnapshot`)
- Media Library: Polling via API (`fetchMedia()`)

**Decision Needed:**
- Standardize on real-time updates?
- Or keep API polling?

**Recommendation:** Use real-time Firestore listeners for both pages for consistency and better UX.

---

## 6. Components to Merge vs Keep Separate

### Components to Merge (Shared Functionality)

1. **Video Preview Modal**
   - Both have similar modals
   - Merge into: `components/admin/VideoPreviewModal.tsx`
   - Props: `video`, `onClose`, `onApprove`, `onReject`, `onDelete`, `onBlur`, `onDownload`

2. **Video Table Row**
   - Similar table structure
   - Merge into: `components/admin/VideoTableRow.tsx`
   - Props: `video`, `onSelect`, `onPreview`, `onAction`

3. **Status Badges**
   - Both have status indicators
   - Merge into: `components/admin/VideoStatusBadges.tsx`
   - Props: `blurStatus`, `aiStatus`, `reviewStatus`, `trainingStatus`

4. **Bulk Actions Bar**
   - Similar bulk action UI
   - Merge into: `components/admin/BulkActionsBar.tsx`
   - Props: `selectedCount`, `onApprove`, `onReject`, `onDelete`, `onExport`

5. **Video Filters**
   - Similar filtering UI
   - Merge into: `components/admin/VideoFilters.tsx`
   - Props: `filters`, `onFilterChange`

### Components to Keep Separate (Page-Specific)

1. **Contributor Stats Panel**
   - Unique to Contributions
   - Keep in: `components/admin/contributions/ContributorStats.tsx`

2. **Import Modals**
   - Unique to Contributions (for now)
   - Keep in: `components/admin/contributions/ImportModal.tsx`
   - Keep in: `components/admin/contributions/DriveImportModal.tsx`

3. **Export Modal**
   - Unique to Contributions (for now)
   - Keep in: `components/admin/contributions/ExportModal.tsx`

4. **AI Analysis Results Panel**
   - Unique to Media Library
   - Keep in: `components/admin/media/AIAnalysisPanel.tsx`

5. **Process Batch Button**
   - Unique to Media Library
   - Keep in: `components/admin/media/ProcessBatchButton.tsx`

### New Shared Components to Create

1. **Video Gallery View**
   - Create: `components/admin/VideoGallery.tsx`
   - Use in both pages

2. **Video Upload/Import Handler**
   - Create: `components/admin/VideoUploader.tsx`
   - Support: Direct upload, Drive import, drag & drop

3. **Blur Status Indicator**
   - Create: `components/admin/BlurStatusBadge.tsx`
   - Use in both pages

4. **Training Approval Panel**
   - Create: `components/admin/TrainingApprovalPanel.tsx`
   - Use in both pages (after AI analysis)

---

## 7. Recommended Consolidation Strategy

### Phase 1: Extract Shared Components
1. Create shared video preview modal
2. Create shared video table row
3. Create shared status badges
4. Create shared bulk actions bar
5. Create shared filters component

### Phase 2: Unify Data Model
1. Standardize on unified status fields
2. Migrate existing data to new schema
3. Update API routes to support unified model

### Phase 3: Add Missing Features
1. Add blur functionality to Media Library
2. Add import to Media Library
3. Add export to Media Library
4. Add gallery view to Media Library
5. Add keyboard shortcuts to Contributions

### Phase 4: Unified Workflow
1. Implement sequential workflow: Review → Blur → AI → Training
2. Add workflow status indicators
3. Add workflow navigation (next step buttons)

### Phase 5: Single Unified Page (Optional)
1. Create unified video management page
2. Use tabs/filters to separate concerns:
   - All Videos
   - Contributor Uploads
   - Training Corpus
   - Processing Queue
3. Deprecate separate pages

---

## 8. API Route Consolidation

### Current State
- Contributions: 7 unique API routes
- Media Library: 5 unique API routes
- **Total: 12 routes** (some overlap)

### Recommended Unified Routes

```
/api/admin/videos
  GET    - List videos (with filters)
  POST   - Upload video

/api/admin/videos/{id}
  GET    - Get video details
  DELETE - Delete video

/api/admin/videos/{id}/blur
  POST   - Trigger face blur

/api/admin/videos/{id}/analyze
  POST   - Trigger AI analysis

/api/admin/videos/{id}/approve
  POST   - Approve for training corpus

/api/admin/videos/{id}/reject
  POST   - Reject from training corpus

/api/admin/videos/bulk
  POST   - Bulk operations (delete, approve, reject, analyze, blur)

/api/admin/videos/export
  POST   - Create export (ZIP/manifest)

/api/admin/videos/import
  POST   - Import from Drive or direct upload
```

**Reduction:** 12 routes → 9 routes (25% reduction)

---

## 9. Implementation Priority

### High Priority (Immediate)
1. ✅ Extract video preview modal (used in both)
2. ✅ Extract status badges (used in both)
3. ✅ Add blur to Media Library
4. ✅ Add gallery view to Media Library
5. ✅ Standardize data fetching (real-time vs polling)

### Medium Priority (Next Sprint)
1. Extract bulk actions bar
2. Extract video table row
3. Add import to Media Library
4. Add export to Media Library
5. Unify status model

### Low Priority (Future)
1. Create unified video management page
2. Consolidate API routes
3. Add workflow navigation
4. Add keyboard shortcuts to Contributions

---

## 10. Testing Checklist

After consolidation, test:
- [ ] Video upload from both pages
- [ ] Face blur processing
- [ ] AI analysis processing
- [ ] Training approval workflow
- [ ] Bulk operations (approve, reject, delete)
- [ ] Export functionality
- [ ] Import from Drive
- [ ] Video preview modal
- [ ] Real-time updates
- [ ] Filtering and search
- [ ] Gallery view
- [ ] Keyboard shortcuts (Media Library)
- [ ] Contributor stats (Contributions)

---

## Summary

**Current State:**
- 2 separate pages with overlapping functionality
- 12 API routes
- Different data models
- Inconsistent UX patterns

**Target State:**
- Shared components for common functionality
- Unified data model
- 9 consolidated API routes
- Consistent UX across both pages
- Optional: Single unified page with tabs

**Key Decisions Needed:**
1. Keep separate approval workflows or merge?
2. Add blur to Media Library?
3. Add import/export to Media Library?
4. Standardize on real-time updates?
5. Eventually merge into single page?

