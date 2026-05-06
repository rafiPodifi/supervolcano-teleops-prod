# Build and Upload iOS App to TestFlight via EAS

## Prerequisites

- ✅ Apple Developer Account (paid membership required)
- ✅ App created in App Store Connect
- ✅ Bundle ID: `com.supervolcano.camera` (already configured)
- ✅ Expo account (create at https://expo.dev/signup if needed)

---

## Step 1: Install EAS CLI and Login

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# If you don't have an Expo account, create one at:
# https://expo.dev/signup
```

---

## Step 2: Update eas.json with Your Apple Credentials

**Edit `eas.json` and replace these placeholders:**

- `YOUR_APPLE_ID_EMAIL@example.com` → Your Apple ID email
- `YOUR_TEAM_ID` → Found at https://developer.apple.com/account (Membership section)
- `PLACEHOLDER` → Your App Store Connect App ID (10-digit number, get from App Store Connect)

**To get your Team ID:**
1. Go to https://developer.apple.com/account
2. Click "Membership" in the sidebar
3. Find "Team ID" (it's a 10-character alphanumeric string)

**To get your ASC App ID:**
1. Go to https://appstoreconnect.apple.com
2. Click on your app (SuperVolcano Camera)
3. Go to "App Information" (under General)
4. Find **Apple ID** (it's a 10-digit number like `1234567890`)

---

## Step 3: Build for iOS Production

```bash
# Navigate to mobile-app directory
cd mobile-app

# Build for iOS production (takes 15-20 minutes)
eas build --platform ios --profile production
```

**During the build, you'll be asked:**
- ✅ "Would you like to automatically create credentials?" → **YES**
- ✅ "Generate a new Apple Distribution Certificate?" → **YES**
- ✅ "Generate a new Apple Provisioning Profile?" → **YES**

**EAS will handle all Apple certificates automatically!**

---

## Step 4: Monitor Build Progress

```bash
# View build status
eas build:list

# Or check the URL provided by EAS
# Example: https://expo.dev/accounts/[username]/projects/[project]/builds/[build-id]
```

**Build typically takes 15-20 minutes for first build.**

---

## Step 5: Submit to TestFlight

**Once build is complete (you'll get a notification), run:**

```bash
# Submit latest build to App Store Connect / TestFlight
eas submit --platform ios --latest
```

**You'll be asked:**
- ✅ "Do you want to upload to App Store Connect?" → **YES**

**This uploads the app to TestFlight automatically!**

---

## Step 6: Complete TestFlight Setup

**In App Store Connect (https://appstoreconnect.apple.com):**

1. Go to your app
2. Click **TestFlight** tab
3. Wait 5-10 minutes for Apple to process the build
4. Once processed, you'll see your build version (1.0.0 build 1)

**Add Internal Testers:**
1. Click "Internal Testing" group (or create one)
2. Click "+" next to Testers
3. Add testers by email
4. They'll receive an email invite
5. They download **TestFlight app** from App Store
6. They can install your app via TestFlight

---

## Quick Commands Reference

```bash
# Check build status
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Cancel a build
eas build:cancel

# Re-run failed build
eas build --platform ios --profile production

# Submit latest build
eas submit --platform ios --latest

# Check credentials
eas credentials --platform ios
```

---

## Common Issues & Solutions

### Issue: "No valid signing certificates"
```bash
# Clear credentials and try again
eas credentials --platform ios
# Select "Remove all credentials"
# Then run build again
```

### Issue: "Apple ID authentication failed"
- Make sure you're logged into the correct Apple account
- Try: `eas build --platform ios --profile production --clear-cache`

### Issue: "Bundle ID already registered"
**This is fine!** You already registered it. EAS will use the existing one.

### Issue: "Build taking too long"
**Normal!** First build can take 20-30 minutes. Subsequent builds are faster.

---

## After Upload Success

**You should see:**
```
✅ Build completed
✅ Submitted to App Store Connect
✅ Processing for TestFlight...
```

**Then in App Store Connect:**
- Build appears in TestFlight within 10 minutes
- Status: "Processing" → "Ready to Test"
- Add testers and start testing!

---

## Next Steps After TestFlight Upload

1. **Test thoroughly** with internal testers
2. **Fix bugs** if found
3. **Update version** in app.json (1.0.0 → 1.0.1)
4. **Build again** with `eas build`
5. **Submit to TestFlight** again
6. When ready: **Submit for App Store review**

---

## Complete Workflow

```bash
# One-time setup
npm install -g eas-cli
eas login

# Update eas.json with your Apple credentials (see Step 2)

# Build and submit
cd mobile-app
eas build --platform ios --profile production
# (wait 15-20 minutes)
eas submit --platform ios --latest

# Check TestFlight in App Store Connect
# Add testers
# Start testing!
```

