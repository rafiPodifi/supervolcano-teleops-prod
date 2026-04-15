# Firebase Admin SDK Test Instructions

## Prerequisites

1. Copy `.env.local.example` to `.env.local`
2. Fill in all Firebase credentials from Firebase Console
3. Verify project ID is: `super-volcano-oem-portal`

## Get Service Account Credentials

1. Go to Firebase Console: https://console.firebase.google.com/project/super-volcano-oem-portal
2. Click Settings (gear icon) > Project Settings
3. Go to "Service Accounts" tab
4. Click "Generate new private key"
5. Download JSON file
6. Extract these values to `.env.local`:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (keep the `\n` characters!)

## Run Tests

### Step 1: Check Environment Variables

```bash
npm run dev
```

Then visit or curl:
```bash
curl http://localhost:3000/api/test-firebase/env
```

Expected output:

```json
{
  "allSet": true,
  "message": "✅ All required environment variables are set"
}
```

### Step 2: Test Firebase Operations

```bash
curl http://localhost:3000/api/test-firebase
```

Or visit in browser: http://localhost:3000/api/test-firebase

Expected output (success):

```json
{
  "success": true,
  "message": "✅ All Firebase Admin SDK operations successful!",
  "tests": {
    "config": { "status": "success" },
    "create": { "status": "success" },
    "read": { "status": "success" },
    "update": { "status": "success" },
    "query": { "status": "success" },
    "delete": { "status": "success" },
    "batch": { "status": "success" }
  }
}
```

## If Tests Fail

### 404 "Database does not exist" Error

1. Verify project ID in `.env.local` matches Firebase Console
2. Check Firebase Console > Firestore Database exists
3. Verify database is in "Native" mode (not Datastore mode)
4. Check database location is `nam5` (multi-region)
5. Verify `FIRESTORE_DATABASE_ID=default` (without parentheses) in `.env.local`

### Permission Error

1. Go to Google Cloud Console: https://console.cloud.google.com/iam-admin/iam?project=super-volcano-oem-portal
2. Find your service account email (from `FIREBASE_ADMIN_CLIENT_EMAIL`)
3. Verify it has these roles:
   - Cloud Datastore User
   - Firebase Admin SDK Administrator Service Agent

### Timeout Error

1. Check your network connection
2. Verify Firestore API is enabled: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=super-volcano-oem-portal
3. Try again (sometimes first connection takes longer)

### Missing Environment Variables

1. Check `.env.local` exists in project root
2. Verify all `FIREBASE_ADMIN_*` variables are set
3. Make sure `FIREBASE_ADMIN_PRIVATE_KEY` includes the full key with `\n` characters
4. Restart the dev server after updating `.env.local`

## Success Criteria

✅ All 7 tests pass (config, create, read, update, query, delete, batch)
✅ No errors in console
✅ Response shows `"success": true`
✅ No 404 "database does not exist" errors

## Next Steps

**Only proceed with building features after this test passes 100%**

Once all tests pass:
1. ✅ Firebase Admin SDK is properly configured
2. ✅ Firestore writes are working
3. ✅ Database connection is verified
4. ✅ Safe to build teleoperator management features

