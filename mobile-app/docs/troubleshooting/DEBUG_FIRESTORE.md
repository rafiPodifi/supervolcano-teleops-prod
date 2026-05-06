# Debug Firestore Connection

## What Was Added

✅ Comprehensive debug logging in:
- `src/config/firebase.ts` - Firebase initialization
- `src/screens/HomeScreen.tsx` - Location loading
- `src/services/api.ts` - Firestore queries

✅ Environment variables verified - `.env.local` exists with correct values

## Next Steps

### 1. Restart Expo with Cache Clear

```bash
# In your terminal, press Ctrl+C to stop current server
# Then run:
cd mobile-app
npx expo start --clear
```

### 2. Reload App on Phone

- Shake phone → Tap "Reload"
- Or close Expo Go completely and reopen

### 3. Check Terminal Logs

**Look for these logs in your Cursor terminal:**

**✅ Good signs:**
```
🔥 Initializing Firebase...
🔥 Project ID: super-volcano-oem-portal
✅ Firebase config loaded successfully
✅ Firebase initialized
🔍 DEBUG: Starting loadData...
🔍 Firebase Project ID: super-volcano-oem-portal
📍 Fetching locations from Firestore...
📍 Found 6 locations in Firestore
📍 Location: Test House (bd577ffe...)
✅ Load data complete
```

**❌ Bad signs:**
```
❌ Missing Firebase config keys: [projectId, apiKey]
→ Means .env.local not loading

❌ Firebase: Error (auth/api-key-not-valid)
→ Means wrong API key

❌ Firebase: Missing or insufficient permissions
→ Means Firestore rules blocking

❌ Network request failed
→ Means phone not connected or Firebase blocked
```

## If Environment Variables Not Loading

If you see `❌ Missing Firebase config keys`, try hardcoding temporarily:

**File**: `mobile-app/src/config/firebase.ts`

Replace the config object with hardcoded values from your `.env.local`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyBJd8_A8tH6e2S5WhgwHqoeXIB58WQWDvw",
  authDomain: "super-volcano-oem-portal.firebaseapp.com",
  projectId: "super-volcano-oem-portal",
  storageBucket: "super-volcano-oem-portal.firebasestorage.app",
  messagingSenderId: "243745387315",
  appId: "1:243745387315:web:88448a0ee710a8fcc2c446",
};
```

This will tell us if the problem is env vars not loading.

## Check Firestore Rules

**Firebase Console → Firestore Database → Rules**

Make sure locations are readable:

```javascript
match /locations/{locationId} {
  allow read: if true;
}

match /tasks/{taskId} {
  allow read: if true;
}
```

## What to Share

After restarting, tell me:

1. **What logs appear in terminal?** (copy/paste the console output)
2. **Do you see the 🔥 Firebase initialization logs?**
3. **Do you see the 📍 location fetching logs?**
4. **Any error messages?**
5. **How many locations should you have?** (check Firebase Console)

