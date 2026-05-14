# EAS Build Setup Guide - Remote Team Testing

## Quick Start

### Step 1: Install EAS CLI

**Option A: Use pnpm dlx (no install needed)**

```bash
# Just use pnpm dlx - no installation required
pnpm dlx eas-cli login
```

**Option B: Install globally**

```bash
pnpm add -g eas-cli
eas login
```

### Step 2: Login to Expo

```bash
cd mobile-app
pnpm dlx eas-cli login
```

Create an account at [expo.dev](https://expo.dev) if you don't have one.

### Step 3: Initialize EAS Project

```bash
pnpm dlx eas-cli build:configure
```

This will:

- Create/update `eas.json` (already created)
- Link your project to Expo
- Generate a project ID

### Step 4: Build for Testing

**Build Android APK (easiest for testing):**

```bash
pnpm run eas:build:android
```

**Build iOS (requires device registration first):**

```bash
pnpm run eas:build:ios
```

**Build both platforms:**

```bash
pnpm run eas:build:all
```

## iOS Device Registration

Before building for iOS, register team devices:

```bash
pnpm run eas:device:create
```

This generates a link to share with iOS testers. They:

1. Open link on their iPhone
2. Follow prompts to register device
3. Device gets added to provisioning profile

**After devices are registered, rebuild:**

```bash
pnpm run eas:build:ios
```

## Android Build (No Registration Needed)

Android is simpler - just build and share:

```bash
pnpm run eas:build:android
```

After build completes, you'll get a download URL. Share with team members who can:

1. Download APK
2. Enable "Install from Unknown Sources" if prompted
3. Install and test

## Over-The-Air (OTA) Updates

When you make JS/UI changes (no native code changes), push updates without rebuilding:

```bash
pnpm run eas:update -- --message "Fixed UI bugs"
```

Team members get updates automatically on next app open.

**What OTA updates work for:**

- ✅ JavaScript code changes
- ✅ React components
- ✅ Assets (images, fonts)
- ❌ Native code changes (requires new build)

## View Builds

```bash
pnpm run eas:build:list
```

## Environment Variables

If you need to set environment variables for builds:

```bash
# Set secrets (won't be in code)
pnpm dlx eas-cli secret:create --scope project --name API_URL --value https://your-api.com
pnpm dlx eas-cli secret:create --scope project --name GOOGLE_MAPS_KEY --value <YOUR_MAPS_KEY>
```

Access in your app:

```typescript
import Constants from "expo-constants";

const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

## Build Profiles

### Preview (Internal Testing)

- **Use this for team testing**
- Internal distribution only
- iOS: Ad-hoc provisioning (max 100 devices)
- Android: APK (easy to install)

### Production (App Store/Play Store)

- For public release
- Requires Apple Developer ($99/year) and Google Play ($25 one-time)

## Common Workflows

### New Feature Testing

```bash
# Make code changes
git commit -m "New feature"

# Build new version
pnpm run eas:build:all

# Share build URLs with team
```

### Quick Bug Fix (OTA Update)

```bash
# Fix bug
git commit -m "Fixed login bug"

# Push OTA update (no rebuild needed)
pnpm run eas:update -- --message "Fixed login bug"

# Team gets update automatically
```

### Native Code Change

```bash
# Added new native library or changed app.json
# Must rebuild (OTA won't work)
pnpm run eas:build:all
```

## Team Member Instructions

### For iOS Testers

1. **Register your device first:**
   - Open device registration link (provided by admin)
   - Follow prompts on your iPhone
   - Wait for build notification

2. **Install the app:**
   - Open install link (provided by admin)
   - Tap "Install"
   - Trust certificate: Settings → General → VPN & Device Management

3. **Get updates:**
   - Updates install automatically
   - Or shake phone → "Reload" to force check

### For Android Testers

1. **Install the app:**
   - Download APK from link (provided by admin)
   - Enable "Install from Unknown Sources" if prompted
   - Install and open

2. **Get updates:**
   - Updates install automatically on next app open
   - Or restart app to check for updates

## Troubleshooting

### Build Fails

```bash
# Check build logs
pnpm dlx eas-cli build:view [build-id]
```

Common issues:

- Missing credentials (iOS signing)
- Invalid bundle identifier
- Native module conflicts

### iOS Devices Not Installing

- Verify device is registered: `pnpm dlx eas-cli device:list`
- Rebuild after adding new devices
- Check provisioning profile is valid

### Android Not Installing

- Ensure "Unknown Sources" enabled
- Check minimum SDK version in app.json
- Clear previous version if updating

## Cost

**Free tier includes:**

- Unlimited builds/month (personal accounts)
- 30 builds/month (organization accounts)
- Unlimited OTA updates
- Unlimited team members

**If you need more:**

- Production plan: $29/month (unlimited builds)

## Next Steps

1. **Login and configure:**

   ```bash
   pnpm dlx eas-cli login
   pnpm dlx eas-cli build:configure
   ```

2. **Build your first preview:**

   ```bash
   pnpm run eas:build:android  # Start with Android (easier)
   ```

3. **Share build URL with team**

4. **Push updates as needed:**
   ```bash
   pnpm run eas:update -- --message "Update description"
   ```

## Quick Reference

```bash
# Login
pnpm dlx eas-cli login

# Configure project
pnpm dlx eas-cli build:configure

# Build Android
pnpm run eas:build:android

# Build iOS
pnpm run eas:build:ios

# Build both
pnpm run eas:build:all

# Push OTA update
pnpm run eas:update -- --message "Your update message"

# View builds
pnpm run eas:build:list

# Register iOS device
pnpm run eas:device:create
```
