# SuperVolcano Camera Mobile App

React Native mobile app (Expo) for recording cleaning task videos with wearable cameras and uploading directly to Firebase Storage.

## Features

- ✅ Video recording with device camera
- ✅ Direct upload to Firebase Storage (never touches camera roll)
- ✅ Offline queue for failed uploads
- ✅ Location and job selection from Firestore
- ✅ Integration with existing web app APIs
- ✅ Secure video storage (auto-delete after upload)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

The repo pins pnpm via the `packageManager` field. Run `corepack enable`
once so the pinned version is used automatically.

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.local.example .env.local
```

Get these values from your web app's `.env.local` file:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_API_BASE_URL` (your Vercel deployment URL)

### 3. Start Development Server

```bash
pnpm exec expo start
```

### 4. Test on Device

1. Install **Expo Go** app on your phone
2. Scan the QR code from the terminal
3. Grant camera permissions when prompted
4. Test the workflow:
   - Select location
   - Select job
   - Record video
   - Video goes to upload queue
   - Return to home screen
   - Upload videos

## Architecture

```
Mobile App → Firebase Storage → Firestore → Web Dashboard → SQL → Robot API
```

- Videos are recorded to app container (not camera roll)
- Videos upload directly to Firebase Storage
- Metadata saved via existing web app API
- Videos appear in web dashboard after sync
- Robots can query videos via Robot API

## Project Structure

```
mobile-app/
├── App.tsx                 # Main app with navigation
├── src/
│   ├── config/
│   │   └── firebase.ts     # Firebase initialization
│   ├── services/
│   │   ├── api.ts          # Firestore queries & API calls
│   │   ├── upload.ts       # Firebase Storage upload
│   │   └── queue.ts        # Offline upload queue
│   ├── screens/
│   │   ├── HomeScreen.tsx      # Location selection
│   │   ├── JobSelectScreen.tsx # Job selection
│   │   └── CameraScreen.tsx    # Video recording
│   └── types/
│       └── index.ts        # TypeScript types
└── .env.local              # Environment variables
```

## Security Features

- ✅ Videos stored in app container only
- ✅ Auto-delete after upload
- ✅ Direct Firebase upload (encrypted)
- ✅ No camera roll permissions requested
- ✅ Secure API communication
- ✅ Offline queue in secure storage

## Building for Production

### iOS (TestFlight)

```bash
eas build --platform ios
eas submit --platform ios
```

### Android (Play Store)

```bash
eas build --platform android
eas submit --platform android
```

## Troubleshooting

### Camera Permission Denied

- Go to device Settings → Apps → SuperVolcano Camera → Permissions
- Enable Camera and Microphone

### Upload Fails

- Check internet connection
- Verify Firebase Storage rules allow uploads
- Check `.env.local` has correct Firebase config
- Videos will remain in queue for retry

### No Locations/Jobs Showing

- Verify Firebase Firestore has locations and tasks
- Check `.env.local` has correct Firebase config
- Ensure web app is synced with Firestore

## Next Steps

- [ ] Add hardware camera SDK (DJI, Insta360)
- [ ] Add video preview before upload
- [ ] Add manual retry for failed uploads
- [ ] Add upload progress notifications
- [ ] Add multiple video recording
- [ ] Add dark mode
- [ ] Add biometric lock
