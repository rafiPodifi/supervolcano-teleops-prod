# Update .env.local

## Add Database ID

**File**: `mobile-app/.env.local`

Add this line to your existing `.env.local` file:

```bash
# Database ID (no parentheses!)
EXPO_PUBLIC_FIREBASE_DATABASE_ID=default
```

## Complete .env.local Example

```bash
# Firebase Config
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBJd8_A8tH6e2S5WhgwHqoeXIB58WQWDvw
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=super-volcano-oem-portal.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=super-volcano-oem-portal
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=super-volcano-oem-portal.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=243745387315
EXPO_PUBLIC_FIREBASE_APP_ID=1:243745387315:web:88448a0ee710a8fcc2c446

# Database ID (no parentheses!)
EXPO_PUBLIC_FIREBASE_DATABASE_ID=default

# API Base URL
EXPO_PUBLIC_API_BASE_URL=https://supervolcano-teleops.vercel.app
```

**Important**: Use `default` not `(default)` - no parentheses!

