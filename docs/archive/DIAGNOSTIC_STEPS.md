# 🔍 Diagnostic Steps - Firestore 404 Error

## Quick Tests

### 1. Test Firestore Reads
Open in browser or use curl:
```
https://supervolcano-teleops.vercel.app/api/test-firestore-read
```
**OR** if running locally:
```
http://localhost:3000/api/test-firestore-read
```

**What to check:**
- Does it return `success: true`?
- Does it show locations count > 0?
- What does `dbInfo` show? (projectId, databaseId)

### 2. Test Firestore Writes (SDK)
Use curl or Postman:
```bash
curl -X POST https://supervolcano-teleops.vercel.app/api/test-firestore-write \
  -H "Cookie: [your auth cookie]"
```

**What to check:**
- Does it return `success: true`?
- What does `tokenClaims` show? (role should be "admin")
- What does `dbInfo` show?
- If it fails, what's the error code/message?

### 3. Test Manual Document Creation
1. Go to Firebase Console → Firestore Database
2. Click on `locations` collection
3. Click "+ Add document"
4. Enter document ID: `test-manual-123`
5. Add field: `name` (string) = `Test Location`
6. Click "Save"

**Does this work?** If yes → database exists and you have Console access. If no → deeper issue.

## Interpreting Results

### Scenario A: Reads work, writes fail
- **Issue:** Permissions/authentication
- **Fix:** Check Firestore rules, verify admin role, refresh token

### Scenario B: Both reads and writes fail (SDK)
- **Issue:** Firebase configuration or connection
- **Fix:** Check Firebase config, project ID, database initialization

### Scenario C: Reads work, SDK writes fail, REST API writes fail
- **Issue:** Likely permissions for writes specifically
- **Fix:** Check Firestore rules for write permissions

### Scenario D: All work except REST API
- **Issue:** REST API endpoint/format issue
- **Fix:** Check URL format, method, payload format

## Key Information to Share

After running the tests, share:
1. Response from `/api/test-firestore-read`
2. Response from `/api/test-firestore-write`
3. Result of manual document creation test
4. What you see in `/admin/properties` page (are locations listed?)

This will help pinpoint the exact issue.

