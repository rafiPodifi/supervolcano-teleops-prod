# Firebase Storage Rules for Direct Uploads

## Setup Instructions

1. Go to Firebase Console → Storage → Rules
2. Replace the existing rules with the following:

### Production Rules (Recommended)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload to media folder
    match /media/{allPaths=**} {
      allow read: if true; // Public read for robot access
      allow write: if request.auth != null; // Only authenticated users can upload
    }
    
    // Deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Development Rules (Temporary - Less Secure)

If you don't have authentication set up yet, you can temporarily use:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // TEMPORARY - lock down in production
    }
  }
}
```

⚠️ **WARNING**: The development rules allow anyone to upload/delete files. Only use this for testing. Switch to production rules before going live.

## Testing

After updating rules:
1. Try uploading a file from the admin interface
2. Check Firebase Console → Storage to verify the file appears
3. Verify the file URL is accessible

## Security Notes

- Production rules require Firebase Authentication
- Make sure your app has authentication enabled
- Consider adding file type validation in rules
- Consider adding file size limits in rules
- Consider adding path validation to prevent unauthorized uploads

