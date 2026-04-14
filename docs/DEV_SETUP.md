# Local Development Setup Guide

This guide will help you set up the local development environment and test the teleoperator management system.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Firebase project access (credentials)

## Step 1: Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Firebase Client Config (for browser)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBJd8_A8tH6e2S5WhgwHqoeXIB58WQWDvw
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=super-volcano-oem-portal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=super-volcano-oem-portal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=super-volcano-oem-portal.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=243745387315
NEXT_PUBLIC_FIREBASE_APP_ID=1:243745387315:web:88448a0ee710a8fcc2c446

# Firebase Admin SDK (for server-side operations)
FIREBASE_ADMIN_PROJECT_ID=super-volcano-oem-portal
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-fbsvc@super-volcano-oem-portal.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_DATABASE_ID=default
```

**Important Notes:**
- The `FIREBASE_ADMIN_PRIVATE_KEY` should be the full private key from your service account JSON file
- Keep the `\n` characters in the private key (they represent newlines)
- Wrap the private key in quotes if it contains special characters
- The database ID is `default` (without parentheses) for nam5 multi-region databases

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Set Up Test Data

Run the setup script to create test fixtures:

```bash
npm run setup:test
```

This script will:
- ✅ Create a test partner organization (`demo-org`)
- ✅ Create a test admin user in Firebase Auth
- ✅ Set custom claims (role: `superadmin`)
- ✅ Create a Firestore user document

**Test Credentials:**
- Email: `admin@demo.com`
- Password: `TestAdmin123!`
- Role: `superadmin`
- Partner ID: `demo-org`

## Step 4: Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Step 5: Test Connection

Before logging in, verify Firebase connection:

**URL:** http://localhost:3000/api/test-connection

This endpoint will:
- Test Firestore read/write operations
- List collections (partners, teleoperators, users)
- Test Firebase Auth access
- Return detailed diagnostics

**Expected Response:**
```json
{
  "timestamp": "2024-...",
  "firebase": {
    "connected": true,
    "projectId": "super-volcano-oem-portal",
    "databaseId": "default"
  },
  "tests": {
    "firestoreRead": { "success": true },
    "firestoreWrite": { "success": true },
    "authList": { "success": true }
  },
  "collections": {
    "partners": { "exists": true, "count": 1 },
    "teleoperators": { "exists": true, "count": 0 },
    "users": { "exists": true, "count": 1 }
  }
}
```

## Step 6: Test Login

1. Navigate to: http://localhost:3000/login
2. Enter credentials:
   - Email: `admin@demo.com`
   - Password: `TestAdmin123!`
3. Click "Sign In"

**Note:** If you get a "permission denied" error, you may need to:
- Sign out completely
- Clear browser cache
- Sign back in (custom claims are cached in the token)

## Step 7: Test Teleoperator Management

1. Navigate to: http://localhost:3000/admin/teleoperators
2. You should see the teleoperators management page
3. Click "Create Teleoperator"
4. Fill in the form:
   - Email: `teleoperator1@demo.com`
   - Display Name: `Test Teleoperator 1`
   - Partner Organization ID: `demo-org`
   - Phone: `+1 (555) 111-2222` (optional)
5. Click "Create"

**Expected Behavior:**
- ✅ Form submits successfully
- ✅ Toast notification: "Teleoperator created: {uuid}"
- ✅ New teleoperator appears in the list
- ✅ Status dropdown works (Available/Busy/Offline/On Break)

## Troubleshooting

### Firebase Connection Errors

If you see 404 or timeout errors:

1. **Check Environment Variables**
   ```bash
   # Verify all FIREBASE_ADMIN_* vars are set
   echo $FIREBASE_ADMIN_PROJECT_ID
   echo $FIREBASE_ADMIN_CLIENT_EMAIL
   ```

2. **Check Database ID**
   - The database ID should be `default` (not `(default)`)
   - For nam5 multi-region, use `default` without parentheses

3. **Check Service Account**
   - Verify the service account JSON file exists
   - Ensure the private key is correctly formatted with `\n` characters
   - Check that the service account has Firestore permissions

4. **Check Firestore Rules**
   - Rules must allow admin access
   - Visit Firebase Console → Firestore → Rules
   - Ensure rules are deployed

### Authentication Errors

If login fails:

1. **Check Custom Claims**
   ```bash
   npm run list-users
   ```
   Look for `admin@demo.com` and verify custom claims

2. **Refresh Token**
   - Sign out completely
   - Clear browser localStorage
   - Sign back in

3. **Verify User Exists**
   - Check Firebase Console → Authentication → Users
   - Verify `admin@demo.com` exists

### Build Errors

If `npm run dev` fails:

1. **Check TypeScript Errors**
   ```bash
   npx tsc --noEmit
   ```

2. **Check Missing Dependencies**
   ```bash
   npm install
   ```

3. **Clear Next.js Cache**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Test Checklist

- [ ] `npm run dev` starts without errors
- [ ] `npm run setup:test` creates admin user successfully
- [ ] http://localhost:3000/api/test-connection returns success
- [ ] Can log in with `admin@demo.com` / `TestAdmin123!`
- [ ] Can navigate to `/admin/teleoperators`
- [ ] Can create a new teleoperator
- [ ] Teleoperator appears in the list
- [ ] Can update teleoperator status
- [ ] No console errors

## Next Steps

Once teleoperator management is working:

1. Test location management (when built)
2. Test task management (when built)
3. Test assignment interface (when built)
4. Test teleoperator portal (when built)

## Support

If you encounter issues:

1. Check the browser console for errors
2. Check the terminal for server errors
3. Check `/api/test-connection` for Firebase diagnostics
4. Review Firestore rules in Firebase Console
5. Verify environment variables are set correctly

## URLs Reference

- **Login:** http://localhost:3000/login
- **Admin Dashboard:** http://localhost:3000/admin
- **Teleoperators:** http://localhost:3000/admin/teleoperators
- **Test Connection:** http://localhost:3000/api/test-connection

