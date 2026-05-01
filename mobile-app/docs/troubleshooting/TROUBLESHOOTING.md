# Expo Go Loading Issues - Troubleshooting

## Issue: "Opening project..." stuck

If Expo Go is stuck on "Opening project..." with a message about checking internet connectivity, try these steps:

### Step 1: Check Metro Bundler
Make sure Metro bundler is running and accessible:

```bash
cd mobile-app
npx expo start --clear
```

Look for:
- ✅ "Metro waiting on..."
- ✅ QR code displayed
- ✅ "Expo Go" option available

### Step 2: Check Network Connection
1. **Same WiFi**: Phone and computer must be on the same WiFi network
2. **Firewall**: Check if firewall is blocking Metro bundler (port 8081)
3. **VPN**: Disable VPN if active (can interfere with local network)

### Step 3: Try Tunnel Mode
If local network isn't working, use tunnel:

```bash
npx expo start --tunnel
```

This uses Expo's servers to connect (slower but more reliable).

### Step 4: Check for Errors
Look at the terminal running `expo start` for:
- ❌ Red error messages
- ❌ Module not found errors
- ❌ Syntax errors

### Step 5: Restart Everything
1. Stop Metro bundler (Ctrl+C)
2. Close Expo Go app completely
3. Clear Expo cache:
   ```bash
   npx expo start --clear
   ```
4. Reopen Expo Go
5. Scan QR code again

### Step 6: Check app.json
Verify `app.json` has correct entry point:
- `main` should point to `index.ts` (or `expo.entryPoint` if set)

### Step 7: Try Development Build
If Expo Go continues to fail, consider using a development build:

```bash
npx expo run:ios
# or
npx expo run:android
```

### Common Issues:

1. **"newArchEnabled": true** - New Architecture might cause issues in Expo Go
   - Try setting to `false` in `app.json`

2. **Large bundle size** - App might be too large for Expo Go
   - Check bundle size in terminal
   - Consider code splitting

3. **Firebase initialization** - Firebase might be blocking
   - Check Firebase config is correct
   - Verify network can reach Firebase

4. **TypeScript errors** - Type errors can prevent bundling
   - Check for TypeScript errors in terminal
   - Fix any type issues

### Quick Fix:
Try disabling new architecture temporarily:

```json
{
  "expo": {
    "newArchEnabled": false
  }
}
```

Then restart: `npx expo start --clear`

