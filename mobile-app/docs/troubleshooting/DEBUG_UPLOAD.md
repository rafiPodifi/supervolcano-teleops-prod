# Debug Video Upload - Step by Step Guide

## Current Status
- ✅ App loads in Expo Go
- ✅ Can record videos
- ❌ Videos not uploading to Firebase Storage
- ❌ Videos not appearing in web portal

## Debugging Steps

### Step 1: Check Console Logs

When you tap "Upload" in the app, watch the terminal running `expo start` for these logs:

```
═══════════════════════════════════════
🔄 PROCESS QUEUE START
═══════════════════════════════════════
```

Then you should see:
```
═══════════════════════════════════════
📹 UPLOAD START
═══════════════════════════════════════
```

### Step 2: Look for These Specific Errors

**Error: "storage/unauthorized"**
→ Firebase Storage rules are blocking uploads
→ Fix: Update Storage rules (see FIREBASE_STORAGE_RULES.md)

**Error: "storage/object-not-found"**
→ Storage reference is wrong
→ Check Firebase config

**Error: "Network request failed"**
→ Network connectivity issue
→ Try tunnel mode: `npx expo start --tunnel`

**Error: "Blob size is 0"**
→ Video file is empty
→ Try recording again

**Error: "Firebase Storage is not initialized"**
→ Firebase config issue
→ Check .env.local file

### Step 3: Verify Firebase Config

Check that these environment variables are set in `.env.local`:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

**Important:** Storage bucket should be: `your-project.appspot.com` (not `.firebasestorage.app`)

### Step 4: Test Upload Manually

1. Record a 5-second video
2. Go to home screen
3. Tap upload banner
4. Watch console logs carefully
5. Copy the FULL error message if it fails

### Step 5: Check Firebase Console

After upload attempt:

1. **Firebase Console → Storage**
   - Look in `media/{locationId}/{jobId}/` folder
   - If file exists → upload worked ✅
   - If no file → upload failed ❌

2. **Firebase Console → Firestore → media collection**
   - Should see new document
   - Check `storageUrl` field
   - Should be a Firebase Storage URL

### Step 6: Common Issues

**Issue: Upload starts but never completes**
- Check network connection
- Check if blob size is reasonable (not 0)
- Check Firebase Storage rules

**Issue: "Permission denied" error**
- Storage rules are too restrictive
- Update rules to allow writes

**Issue: Upload completes but no file in Storage**
- Check Storage bucket name matches config
- Check file path is correct
- Check Storage rules allow writes

**Issue: Metadata API fails**
- Check API_BASE_URL is correct
- Check network can reach Vercel
- Check API endpoint exists: `/api/teleoperator/media/metadata`

## What to Share for Help

If upload still fails, share:

1. **Full console log output** from upload attempt
2. **Error message** (exact text)
3. **Firebase Storage rules** (screenshot)
4. **Firebase config** (with sensitive values redacted)
5. **Network tab** (if using Expo web)

## Quick Test

Try this minimal test:

```typescript
// In your app, add this test function
async function testUpload() {
  try {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const storageRef = ref(storage, `test/${Date.now()}.txt`);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    console.log('✅ Test upload successful:', url);
  } catch (error) {
    console.error('❌ Test upload failed:', error);
  }
}
```

If this works, the issue is with video file handling.
If this fails, the issue is with Firebase Storage setup.

