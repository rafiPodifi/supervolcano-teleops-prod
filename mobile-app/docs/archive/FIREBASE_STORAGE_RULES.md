# Firebase Storage Rules for Mobile App

## Current Issue: Videos Not Uploading

If videos are not uploading, check Firebase Storage rules.

## Quick Fix (Temporary - for testing)

Go to **Firebase Console → Storage → Rules** and paste this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // TEMPORARY - Allow all uploads for testing
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

Click **"Publish"** and wait 30 seconds.

## Production Rules (After Testing)

Once uploads work, update to secure rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Media uploads from mobile app
    match /media/{allPaths=**} {
      allow read: if true; // Anyone can read
      allow write: if true; // Allow uploads for now (add auth later)
    }
  }
}
```

## Verify Rules Are Active

1. Go to Firebase Console → Storage
2. Click "Rules" tab
3. Verify rules are published (not just saved)
4. Wait 30 seconds after publishing

## Test Upload

After updating rules:
1. Record a video in mobile app
2. Try to upload
3. Check console logs for errors
4. Check Firebase Console → Storage for the file

