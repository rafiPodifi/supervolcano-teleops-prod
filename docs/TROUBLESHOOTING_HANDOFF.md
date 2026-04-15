# Firestore Write Failure - Complete Handoff Document

## Problem Summary

**Issue:** Location/property creation fails with 404 error: "The database (default) does not exist for project super-volcano-oem-portal"

**Symptoms:**
- Both Firestore SDK (`setDoc`) and REST API fallback return 404 errors
- Error message: "The database (default) does not exist for project super-volcano-oem-portal"
- Firestore API is **enabled** in Google Cloud Console (confirmed by user)
- Database exists in Firebase Console (user can see collections: `locations`, `tasks`, etc.)
- Database location: `nam5` (North America multi-region)
- 41% error rate on Firestore API calls (124 requests, 51 errors)

**What works:**
- User can see database in Firebase Console
- Collections exist (`locations`, `tasks`, `sessions`, etc.)
- Firestore API is enabled
- Authentication works (user is logged in)

**What doesn't work:**
- Creating new documents in `locations` collection
- Both SDK writes and REST API writes fail with 404

## Project Context

**Project ID:** `super-volcano-oem-portal`  
**Firebase Project:** `super-volcano-oem-portal`  
**Database ID:** `(default)`  
**Database Location:** `nam5` (multi-region)  
**Deployment:** Vercel (https://supervolcano-teleops.vercel.app)

**Recent Changes:**
- Refactored `properties` → `locations` collection
- Refactored `propertyId` → `locationId` field
- Added UUID generation for new documents
- Added ownership fields (`createdBy`, `updatedBy`)
- Added admin role custom claims

## Key Files

### 1. Firebase Configuration
**File:** `src/lib/firebaseClient.ts`
```typescript
export const firebaseConfig = {
  apiKey: "AIzaSyBJd8_A8fH6e2S5GwHwHoeXIB58WQWDvw",
  authDomain: "super-volcano-oem-portal.firebaseapp.com",
  projectId: "super-volcano-oem-portal",  // ← VERIFY THIS MATCHES
  storageBucket: "super-volcano-oem-portal.firebasestorage.app",
  messagingSenderId: "243745387315",
  appId: "1:243745387315:web:88448a0ee710a8fcc2c446",
};
```

### 2. Property Creation Repository
**File:** `src/lib/repositories/propertiesRepo.ts`

**Key function:** `createProperty()` (line ~302)
- Uses `setDoc` with pre-generated document ID
- Has 10-second timeout
- Falls back to REST API if SDK times out

**REST API fallback:** `writePropertyViaRestApi()` (line ~23)
- Uses PATCH method (was POST, fixed to PATCH)
- No `updateMask` (was included, removed)
- URL format: `https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/locations/{docId}`
- Returns 404 "database does not exist"

### 3. Property Creation UI
**File:** `src/app/admin/properties/page.tsx`
- Calls `createProperty()` from repository
- Handles both SDK and REST API failures
- Shows error to user

### 4. Firestore Security Rules
**File:** `src/firebase/firestore.rules`
```javascript
match /locations/{locationId} {
  allow read: if partnerMatches(resource.data.partnerOrgId);
  allow create, update, delete: if isAdmin();
}
```

## What's Been Tried

### 1. SDK Fixes ✅
- [x] Changed `addDoc` → `setDoc` (to ensure UUID generation)
- [x] Added token refresh before writes
- [x] Added connection verification (`waitForPendingWrites`, `enableNetwork`)
- [x] Added 10-second timeout
- [x] Verified admin role in token claims

### 2. REST API Fixes ✅
- [x] Changed POST → PATCH (for specific document IDs)
- [x] Removed `updateMask` parameter (not needed for new documents)
- [x] Added URL encoding for project ID
- [x] Added database ID extraction from SDK
- [x] Added regional endpoint fallback (for multi-region `nam5`)

### 3. Configuration Fixes ✅
- [x] Verified Firestore API is enabled
- [x] Verified database exists in Console
- [x] Verified database location (`nam5`)
- [x] Verified database ID is `(default)`
- [x] Verified project ID matches

### 4. Authentication Fixes ✅
- [x] Added admin role custom claims
- [x] Added token refresh before writes
- [x] Added token claims verification

**All fixes deployed, but 404 error persists.**

## Current Error Details

### SDK Error
```
SDK_TIMEOUT: setDoc timed out after 10103ms
```
- Happens every time
- Suggests connection/permission issue

### REST API Error
```json
{
  "error": {
    "code": 404,
    "message": "The database (default) does not exist for project super-volcano-oem-portal Please visit https://console.cloud.google.com/datastore/setup?project=super-volcano-oem-portal to add a Cloud Datastore or Cloud Firestore database. ",
    "status": "NOT_FOUND"
  }
}
```
- Happens when SDK times out
- Error suggests database doesn't exist, but it clearly does

## Diagnostic Tools Created

### 1. Read Test Endpoint
**URL:** `GET /api/test-firestore-read`
**Purpose:** Test if Firestore reads work
**Returns:**
- Success/failure
- Location count
- Database configuration info

### 2. Write Test Endpoint
**URL:** `POST /api/test-firestore-write`
**Purpose:** Test if Firestore SDK writes work
**Returns:**
- Success/failure
- Token claims
- Database configuration info
- Document path

**These endpoints should be tested to isolate the issue.**

## Hypothesis & Potential Issues

### Hypothesis 1: Database Mode Mismatch
**Issue:** Database might be in Datastore mode instead of Native mode
**Test:** Check Firebase Console → Firestore Database → Settings
**Fix:** If Datastore mode, need to create new Native mode database

### Hypothesis 2: Project ID Mismatch
**Issue:** Firebase config project ID doesn't match actual project
**Test:** Compare `firebaseClient.ts` project ID with Firebase Console
**Fix:** Update config if mismatch

### Hypothesis 3: Multi-Region Endpoint Issue
**Issue:** `nam5` multi-region might need different endpoint format
**Test:** Check Firestore REST API docs for multi-region endpoint format
**Fix:** Use correct endpoint format for multi-region

### Hypothesis 4: Authentication Token Issue
**Issue:** Token might not have correct permissions or claims
**Test:** Decode JWT token, check claims
**Fix:** Verify admin role, refresh token

### Hypothesis 5: Firestore Rules Blocking Writes
**Issue:** Rules might be blocking writes despite admin check
**Test:** Try creating document manually in Console
**Fix:** Update rules if needed

### Hypothesis 6: Database Not Fully Provisioned
**Issue:** Database exists but not fully initialized
**Test:** Try manual document creation in Console
**Fix:** Wait for provisioning, or re-create database

## Critical Questions to Answer

1. **Do reads work?** Can you see existing locations in `/admin/properties`?
   - If YES → reads work, writes fail (permissions issue)
   - If NO → reads also fail (config/connection issue)

2. **Can you create documents manually?** 
   - Go to Firebase Console → Firestore → `locations` collection
   - Try creating a test document manually
   - If YES → database works, issue is in code/API
   - If NO → database/console issue

3. **What does `/api/test-firestore-read` return?**
   - Check if reads work via API
   - Check database configuration info

4. **What does `/api/test-firestore-write` return?**
   - Check if SDK writes work
   - Check token claims
   - Check database configuration

## Code to Review

### REST API URL Construction
**File:** `src/lib/repositories/propertiesRepo.ts` (line ~159)
```typescript
const encodedDatabaseId = databaseId === "(default)" ? "(default)" : encodeURIComponent(databaseId);
let url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(db.app.options.projectId)}/databases/${encodedDatabaseId}/documents/${documentPath}`;
```

**Check:**
- Is `documentPath` correct? (should be `locations/{docId}`)
- Is database ID format correct? (might need URL encoding)
- Is endpoint format correct for multi-region?

### Payload Format
**File:** `src/lib/repositories/propertiesRepo.ts` (line ~40-75)
**Check:** Is payload format correct for Firestore REST API v1?
- Should be: `{ fields: { fieldName: { stringValue: "value" } } }`
- Are all field types converted correctly?
- Are timestamps in correct format?

### Firestore Rules
**File:** `src/firebase/firestore.rules`
**Check:**
- Are rules deployed?
- Do rules allow admin writes?
- Is `isAdmin()` function correct?

## Next Steps for Troubleshooting

### Step 1: Test Diagnostic Endpoints
1. Deploy current code to Vercel
2. Visit `/api/test-firestore-read` - check if reads work
3. POST to `/api/test-firestore-write` - check if SDK writes work
4. Compare results

### Step 2: Verify Configuration
1. Check Firebase Console → Firestore → Settings
   - Database mode (should be Native, not Datastore)
   - Database location (should be `nam5`)
   - Database ID (should be `(default)`)
2. Check Firebase config in code
   - Verify project ID matches Console
   - Verify all config values are correct

### Step 3: Test Manual Creation
1. Go to Firebase Console → Firestore → `locations`
2. Click "+ Add document"
3. Enter ID: `test-manual-123`
4. Add field: `name` = `Test Location`
5. Save
6. **Does this work?** This will tell us if it's a database issue or code issue

### Step 4: Check Network Tab
1. Open DevTools → Network tab
2. Try saving a location
3. Find request to `firestore.googleapis.com`
4. Check:
   - Request URL (full URL)
   - Request method (should be PATCH)
   - Request headers (Authorization, Content-Type)
   - Request body (payload format)
   - Response status (should be 200/201, not 404)
   - Response body (full error message if failed)

### Step 5: Verify Token Claims
1. Decode JWT token (use jwt.io or console)
2. Check for:
   - `role: "admin"` (should be present)
   - `partner_org_id` (should be present)
   - Token expiration (should not be expired)

## Firestore REST API Reference

### Correct Endpoint Format
For creating document with specific ID:
```
PATCH https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{collection_id}/{document_id}
```

### Correct Request Body
```json
{
  "fields": {
    "fieldName": {
      "stringValue": "value"
    },
    "numberField": {
      "integerValue": "123"
    },
    "boolField": {
      "booleanValue": true
    },
    "timestampField": {
      "timestampValue": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Correct Headers
```
Authorization: Bearer {firebase_auth_token}
Content-Type: application/json
```

## Environment Variables to Check

Check for these in Vercel or `.env`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (should be `super-volcano-oem-portal`)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Debugging Commands

### Check Admin Role
```bash
npm run list-users
```
Look for your email, check `role: "admin"` in custom claims

### Set Admin Role (if missing)
```bash
npm run set-admin -- your-email@example.com
```

### Check Firestore Collections
Run in Firebase Console or use Admin SDK script to list collections

## Files That May Need Changes

1. `src/lib/repositories/propertiesRepo.ts` - REST API implementation
2. `src/lib/firebaseClient.ts` - Firebase configuration
3. `src/firebase/firestore.rules` - Security rules (verify deployed)
4. `src/app/admin/properties/page.tsx` - UI that calls create function

## Success Criteria

The issue is fixed when:
- ✅ User can save locations successfully
- ✅ Documents appear in Firebase Console → `locations` collection
- ✅ No 404 errors in console
- ✅ No timeout errors

## Resources

- [Firestore REST API Docs](https://cloud.google.com/firestore/docs/reference/rest)
- [Firestore REST API v1 Reference](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents)
- [Firestore Multi-Region Endpoints](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents)
- [Firebase Console](https://console.firebase.google.com/project/super-volcano-oem-portal/firestore)

## Summary

**The core issue:** Both SDK and REST API fail with 404 "database does not exist", but database clearly exists in Console.

**Most likely causes:**
1. Database mode mismatch (Datastore vs Native)
2. Project ID mismatch in config
3. Multi-region endpoint format issue
4. Authentication token missing required permissions

**Recommended first step:** Test the diagnostic endpoints (`/api/test-firestore-read` and `/api/test-firestore-write`) to isolate whether reads work and what the actual configuration is.

**Next:** Based on diagnostic results, check the specific hypothesis that matches the symptoms.

