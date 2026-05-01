# Mobile App Setup Guide

## Quick Start

### 1. Install Dependencies (Already Done ✅)

All dependencies are installed. You can verify with:
```bash
cd mobile-app
npm list --depth=0
```

### 2. Configure Environment Variables

**IMPORTANT:** You need to create `.env.local` file with your Firebase credentials.

1. Copy the example file:
   ```bash
   cd mobile-app
   cp .env.local.example .env.local
   ```

2. Get your Firebase config from your web app's `.env.local`:
   - Look in `supervolcano-teleoperator-portal/.env.local` (if accessible)
   - Or get from Firebase Console → Project Settings → General → Your apps

3. Fill in `.env.local`:
   ```bash
   EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
   EXPO_PUBLIC_API_BASE_URL=https://your-project.vercel.app
   ```

### 3. Start the App

```bash
cd mobile-app
npx expo start
```

### 4. Test on Your Phone

1. Install **Expo Go** app from App Store / Play Store
2. Scan the QR code shown in terminal
3. Grant camera permissions
4. Test the workflow:
   - Select a location
   - Select a job
   - Record a video
   - Video goes to upload queue
   - Return to home screen
   - Tap "Upload" banner to upload videos

## What Was Created

### ✅ Project Structure
- `src/config/firebase.ts` - Firebase initialization
- `src/services/api.ts` - Firestore queries & API calls
- `src/services/upload.ts` - Firebase Storage upload
- `src/services/queue.ts` - Offline upload queue
- `src/screens/HomeScreen.tsx` - Location selection
- `src/screens/JobSelectScreen.tsx` - Job selection
- `src/screens/CameraScreen.tsx` - Video recording
- `src/types/index.ts` - TypeScript types
- `App.tsx` - Navigation setup
- `app.json` - App configuration with permissions

### ✅ Features Implemented
- Video recording with device camera
- Direct upload to Firebase Storage (no camera roll)
- Offline queue for failed uploads
- Location/job selection from Firestore
- Integration with existing web APIs
- Auto-delete videos after upload

## Testing Checklist

- [ ] App opens on device
- [ ] Camera permission granted
- [ ] Locations load from Firestore
- [ ] Jobs load for selected location
- [ ] Video records successfully
- [ ] Video added to upload queue
- [ ] Video uploads to Firebase Storage
- [ ] Metadata saved via API
- [ ] Video appears in web dashboard
- [ ] Video deleted from device after upload

## Troubleshooting

### "Failed to load locations"
- Check `.env.local` has correct Firebase config
- Verify Firestore has locations collection
- Check internet connection

### "Upload failed"
- Check Firebase Storage rules allow uploads
- Verify `.env.local` has correct Firebase config
- Check internet connection
- Video will stay in queue for retry

### "Camera permission denied"
- Go to device Settings → Apps → SuperVolcano Camera
- Enable Camera and Microphone permissions

## Next Steps

1. **Test the app** on a physical device
2. **Verify uploads** in Firebase Console → Storage
3. **Check metadata** in Firebase Console → Firestore → media collection
4. **View in web app** - videos should appear after sync
5. **Test offline queue** - record videos offline, upload when online

## Production Build

When ready for production:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

