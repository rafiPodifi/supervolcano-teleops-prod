# Direct Firebase Storage Upload Setup

## Overview

Videos now upload directly from the browser to Firebase Storage, bypassing Vercel's 4.5MB API route limit. This enables unlimited file sizes (up to Firebase's limits) and faster uploads.

## Architecture

1. **User selects video** in browser
2. **Upload directly to Firebase Storage** (client-side, no API route)
3. **Get storage URL** from Firebase
4. **Save metadata to Firestore** via lightweight API route (JSON only)
5. **Sync metadata to SQL** later via sync process

## Required Environment Variables

Add these to `.env.local` and Vercel:

```bash
# Firebase Client SDK (for direct uploads)
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

### How to Get These Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → **Project Settings**
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** → **Web** (</> icon)
6. Copy the config values from the `firebaseConfig` object

### Adding to Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add each variable with the `NEXT_PUBLIC_` prefix
3. Make sure to add them to **Production**, **Preview**, and **Development** environments
4. Redeploy after adding variables

## Firebase Storage Rules

Update your Firebase Storage rules (see `FIREBASE_STORAGE_RULES.md`):

1. Go to Firebase Console → **Storage** → **Rules**
2. Copy the rules from `FIREBASE_STORAGE_RULES.md`
3. Click **Publish**

**Important**: For production, use the authenticated rules. For development/testing, you can temporarily use the open rules.

## Testing

1. **Add environment variables** to `.env.local` and Vercel
2. **Update Firebase Storage rules**
3. **Restart dev server** (if running locally)
4. **Try uploading a large video** (>4.5MB) from the admin interface
5. **Check upload progress** - should show percentage
6. **Verify in Firebase Console** - file should appear in Storage
7. **Check Firestore** - metadata should be saved in `media` collection
8. **Run sync** - metadata should sync to SQL database

## Features

✅ **No file size limits** (up to Firebase's 5GB limit per file)
✅ **Progress indicator** - real-time upload progress
✅ **Resumable uploads** - handles network interruptions
✅ **Direct to Storage** - no Vercel API bottleneck
✅ **Automatic metadata** - saves to Firestore after upload
✅ **Error handling** - clear error messages

## File Size Limits

- **Client validation**: 500MB per file (can be adjusted)
- **Firebase Storage**: 5GB per file (hard limit)
- **No Vercel limits**: Files bypass API routes entirely

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Missing or incorrect `NEXT_PUBLIC_FIREBASE_*` environment variables
- Check that all 6 variables are set correctly
- Restart dev server after adding variables

### "Firebase Storage: User does not have permission"
- Update Firebase Storage rules
- Make sure rules allow writes for authenticated users (or use temp open rules for testing)

### Upload progress stuck at 0%
- Check browser console for errors
- Verify Firebase Storage rules allow writes
- Check network connection

### Metadata not saving
- Check API route logs
- Verify authentication token is valid
- Check Firestore permissions

## Migration Notes

The old `/api/admin/media/upload` route is no longer used. Files now upload directly to Firebase Storage, and only metadata is saved via `/api/admin/media/metadata`.

## Next Steps

1. ✅ Add environment variables
2. ✅ Update Firebase Storage rules
3. ✅ Test upload functionality
4. ✅ Verify metadata sync works
5. ✅ Test robot API returns media URLs

