# Firebase Storage Rules - Temporary Development Rules

## ⚠️ IMPORTANT: These are TEMPORARY rules for development only

These rules allow unauthenticated uploads during development. **You must change these before production!**

## Quick Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **super-volcano-oem-portal**
3. Go to **Storage** → **Rules** tab
4. Copy and paste the rules below
5. Click **Publish**

## Temporary Development Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow everyone to read media (public videos for robots and users)
    match /media/{allPaths=**} {
      allow read: if true; // Anyone can view
      allow write: if true; // TEMPORARY: Allow unauthenticated uploads during development
      // TODO: Change to `if request.auth != null` after implementing Firebase Auth
    }
    
    // Restrict other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Production Rules (After Development)

Once you're ready for production, replace the `/media/` rule with:

```javascript
match /media/{allPaths=**} {
  allow read: if true; // Public read for robot access
  allow write: if request.auth != null; // Only authenticated users can upload
}
```

## Why Temporary Rules?

- **Development Speed**: No need to set up authentication for every test upload
- **Testing**: Easier to test upload functionality without auth complexity
- **Quick Iteration**: Focus on getting uploads working first, then secure them

## Security Notes

- ⚠️ **Never deploy these rules to production**
- ⚠️ **Anyone can upload/delete files in `/media/` with these rules**
- ⚠️ **Switch to authenticated rules before going live**
- ✅ **Public read is fine** - videos need to be accessible to robots and users

## When to Switch

Switch to production rules when:
- ✅ Upload functionality is working
- ✅ You've tested with real files
- ✅ You're ready to deploy to production
- ✅ You have Firebase Authentication set up

