# Fix Firebase Storage Upload Permission Error

## The Problem

You're getting `storage/unauthorized` errors when uploading videos because Firebase Storage rules don't allow uploads to the `/media/` path.

## Solution

I've updated the storage rules file to include a rule for `/media/` uploads. Now you need to deploy these rules to Firebase.

## Quick Fix (2 Steps)

### Step 1: Deploy Storage Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **super-volcano-oem-portal**
3. Go to **Storage** → **Rules** tab
4. Copy the rules from below (or run `npx tsx scripts/show-rules.ts`)
5. Paste into the rules editor
6. Click **Publish**

### Step 2: Updated Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.role == "admin";
    }

    function partnerMatches(partnerOrgId) {
      return isAdmin() ||
        (isAuthenticated() && request.auth.token.partner_org_id == partnerOrgId);
    }

    match /orgs/{partnerOrgId}/{allPaths=**} {
      allow read, write: if partnerMatches(partnerOrgId);
    }

    match /public/{allPaths=**} {
      allow read;
      allow write: if isAdmin();
    }

    // Specific rule for instruction images (MUST come before general locations rule)
    // This allows authenticated users to upload instruction images
    match /locations/{locationId}/instructions/{instructionId}/{filename} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // General rule for other location files (requires admin)
    match /locations/{locationId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Media uploads for robot intelligence (allow authenticated users)
    match /media/{allPaths=**} {
      allow read: if true; // Public read for robot access
      allow write: if isAuthenticated(); // Any authenticated user can upload
    }
  }
}
```

## What Changed

Added this new rule at the end:

```javascript
// Media uploads for robot intelligence (allow authenticated users)
match /media/{allPaths=**} {
  allow read: if true; // Public read for robot access
  allow write: if isAuthenticated(); // Any authenticated user can upload
}
```

This allows:
- **Read**: Anyone can read media files (for robot API access)
- **Write**: Only authenticated users can upload (you must be logged in)

## After Deploying

1. Rules take effect immediately (no redeploy needed)
2. Refresh your browser
3. Try uploading the video again
4. The upload should work now! ✅

## Alternative: Use Script

You can also run this script to see the rules:

```bash
npx tsx scripts/show-rules.ts
```

This will print both Firestore and Storage rules that you can copy-paste.

