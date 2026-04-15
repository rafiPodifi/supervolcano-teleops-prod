# Firestore REST API 404 Error - Troubleshooting Guide

## Database Location
Your database is in **`nam5`** (North America multi-region). This is correct and the standard REST API endpoint is the right one to use.

## The Problem
The REST API returns 404 "The database (default) does not exist" even though:
- ✅ Cloud Firestore API is **Enabled** (confirmed in Google Cloud Console)
- ✅ Database exists in Firebase Console (you can see it)
- ✅ API is being called (124 requests showing in metrics)
- ❌ **41% error rate** on Firestore API requests

This suggests the API is enabled, but write requests are failing with 404 while read requests might be working.

## Possible Causes & Solutions

### 1. Firestore API Not Enabled
**Check:**
1. Go to [Google Cloud Console → APIs & Services → Enabled APIs](https://console.cloud.google.com/apis/dashboard?project=super-volcano-oem-portal)
2. Search for "Firestore"
3. Look for "Cloud Firestore API" - make sure it's **Enabled**

**Fix:**
- If it's not enabled, click "Enable API"
- Wait 1-2 minutes for it to propagate

### 2. Database Not Fully Provisioned
**Check:**
- Go to Firebase Console → Firestore Database
- Verify the database shows "nam5" location
- Try creating a test document manually in the Console

**Fix:**
- Wait 5-10 minutes if the database was just created
- Firestore databases can take a few minutes to fully provision

### 3. Wrong Project ID
**Check:**
- Verify your Firebase config has the correct `projectId`: `super-volcano-oem-portal`
- Check `src/lib/firebaseClient.ts` - does `projectId` match the Console?

**Fix:**
- Update Firebase config if project ID is wrong
- Make sure environment variables are set correctly

### 4. Authentication Token Permissions
**Check:**
- Your Firebase Auth token needs permissions to write to Firestore
- Check your user's role in Firebase Console → Authentication

**Fix:**
- Make sure your user has the `admin` role (custom claim)
- Run: `npm run set-admin -- tony@supervolcano.ai`
- Sign out and sign back in to refresh the token

### 5. Firestore Rules Blocking Writes
**Check:**
- Go to Firebase Console → Firestore Database → Rules
- Verify rules allow admin writes: `allow create, update, delete: if isAdmin();`

**Fix:**
- Deploy the correct rules from `src/firebase/firestore.rules`
- Make sure rules are published (click "Publish")

## Quick Verification Steps

1. **Check API is enabled:**
   ```
   https://console.cloud.google.com/apis/dashboard?project=super-volcano-oem-portal
   ```
   Look for "Cloud Firestore API" - should be enabled

2. **Verify database exists:**
   ```
   https://console.firebase.google.com/project/super-volcano-oem-portal/firestore
   ```
   Should show database with collections

3. **Check your Firebase config:**
   - Open `src/lib/firebaseClient.ts`
   - Verify `projectId: "super-volcano-oem-portal"`

4. **Verify admin role:**
   - Run: `npm run list-users`
   - Check that `tony@supervolcano.ai` has `role: "admin"` in custom claims

5. **Try creating a document manually:**
   - Go to Firebase Console → Firestore Database
   - Click "+ Add document" in the `locations` collection
   - If this works, the database exists and the issue is with the API/authentication

## Next Steps

Once you've checked the above:
1. Enable Firestore API if not enabled
2. Wait a few minutes if database was just created
3. Verify your admin role and sign out/in
4. Try saving a location again

The REST API endpoint is correct for `nam5` multi-region database. The 404 is likely due to one of the issues above.

