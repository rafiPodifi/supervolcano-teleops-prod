# How to Check if Locations are Saving in Firebase

## Quick Check in Firebase Console

### 1. Open Firebase Console
- Go to: https://console.firebase.google.com/
- Select your project: `super-volcano-oem-portal`

### 2. Navigate to Firestore Database
- Click "Firestore Database" in the left sidebar
- You should see a list of collections

### 3. Check the `locations` Collection
**IMPORTANT:** The app writes to `locations`, NOT `properties`!

- Look for the `locations` collection in the left panel
- Click on `locations` to see all documents
- If you see documents here, they ARE being saved!

### 4. What to Look For in Each Document

When you click on a document in `locations`, you should see these fields:

**Required Fields:**
- `name` (string) - The location name
- `partnerOrgId` (string) - Usually "demo-org" or your org ID
- `createdBy` (string) - The user's UID who created it
- `createdAt` (timestamp) - When it was created
- `updatedAt` (timestamp) - When it was last updated

**Optional Fields:**
- `address` (string)
- `description` (string)
- `status` (string) - "scheduled" or "unassigned"
- `isActive` (boolean) - Should be `true`
- `images` (array) - Array of image URLs
- `media` (array) - Array of media objects
- `imageCount` (number)
- `videoCount` (number)
- `taskCount` (number)

### 5. Why Demo Properties Don't Show Up

**The Problem:**
- Demo properties are in the `properties` collection (old name)
- The app now reads from `locations` collection
- They're in different collections, so they won't show up!

**The Solution:**
You need to either:
1. **Migrate the data** (run the migration script):
   ```bash
   npm run migrate:locations
   ```
   This will copy documents from `properties` → `locations`

2. **Or manually check both collections:**
   - `properties` = old demo data (won't show in app)
   - `locations` = new data (will show in app)

### 6. How to Verify Writes are Happening

**Method 1: Watch in Real-Time**
1. Open Firebase Console → Firestore Database
2. Click on `locations` collection
3. Try saving a location in the app
4. You should see a new document appear immediately!

**Method 2: Check Document Count**
- Before saving: Note how many documents are in `locations`
- After saving: Check if the count increased
- If count didn't increase, the write failed

**Method 3: Check Browser Network Tab**
1. Open DevTools → Network tab
2. Filter by "firestore" or "googleapis"
3. Try saving a location
4. Look for a POST request to `firestore.googleapis.com`
5. Check the response:
   - **200 OK** = Success! ✅
   - **403 Forbidden** = Permission denied (rules issue)
   - **401 Unauthorized** = Auth issue
   - **No request** = SDK didn't send it (network/SDK issue)

### 7. Common Issues

**Issue: "I see photos in Storage but no locations in Firestore"**
- Photos are saved to Firebase Storage (separate from Firestore)
- Locations are saved to Firestore Database
- They're different services!
- Check the `locations` collection, not Storage

**Issue: "Locations collection is empty"**
- This means writes are failing
- Check:
  1. Browser console for errors
  2. Network tab for failed requests
  3. Firestore rules (must allow admin to create)
  4. User has admin role in token

**Issue: "I see locations in Firebase but not in the app"**
- Check the `partnerOrgId` field matches your user's `partner_org_id` claim
- Check `isActive` is `true` (inactive locations are filtered out)
- Check browser console for read errors

### 8. Check Firestore Rules

1. Go to Firebase Console → Firestore Database → Rules tab
2. Make sure you see:
   ```
   match /locations/{locationId} {
     allow read: if partnerMatches(resource.data.partnerOrgId);
     allow create, update, delete: if isAdmin();
   }
   ```
3. Click "Publish" if you see a "Deploy" button

### 9. Check User Role

Run this to verify your user has admin role:
```bash
npm run list-users
```

Look for your email and check the `customClaims` field. It should show:
```json
{
  "role": "admin",
  "partner_org_id": "demo-org"
}
```

If `role` is not "admin", run:
```bash
npm run set-admin tony@supervolcano.ai
```

Then **sign out and sign back in** to refresh your token.

## Summary

**To check if locations are saving:**
1. ✅ Open Firebase Console → Firestore Database
2. ✅ Click `locations` collection (NOT `properties`)
3. ✅ Check if documents appear when you save
4. ✅ Verify fields like `name`, `partnerOrgId`, `createdBy` are present

**If `locations` is empty:**
- Writes are failing
- Check browser console and Network tab
- Verify admin role and Firestore rules

**If demo properties don't show:**
- They're in `properties` collection (old name)
- Run migration: `npm run migrate:locations`
- Or check `properties` collection directly in Firebase Console

