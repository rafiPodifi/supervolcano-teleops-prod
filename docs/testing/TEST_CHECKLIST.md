# Test Checklist - Teleoperator Management

Use this checklist to verify everything is working correctly.

## ✅ Pre-Test Verification

- [x] `.env.local` exists with all required Firebase variables
- [x] `npm run setup:test` completed successfully
- [x] Test admin user created: `admin@demo.com`
- [x] Partner organization created: `demo-org`

## 🧪 Test Steps

### 1. Start Development Server

```bash
npm run dev
```

**Expected:** Server starts on `http://localhost:3000` without errors

**Status:** ⬜ Not tested

---

### 2. Test Firebase Connection

**URL:** http://localhost:3000/api/test-connection

**Expected Response:**
```json
{
  "firebase": {
    "connected": true,
    "projectId": "super-volcano-oem-portal"
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

**Status:** ⬜ Not tested

---

### 3. Test Login

**URL:** http://localhost:3000/login

**Credentials:**
- Email: `admin@demo.com`
- Password: `TestAdmin123!`

**Expected:**
- ✅ Login form loads
- ✅ Can enter credentials
- ✅ Login succeeds
- ✅ Redirects to `/properties` or `/admin`

**Status:** ⬜ Not tested

**Note:** If you get permission errors, sign out completely and sign back in (custom claims are cached in the token).

---

### 4. Navigate to Teleoperators Page

**URL:** http://localhost:3000/admin/teleoperators

**Expected:**
- ✅ Page loads without errors
- ✅ See "Teleoperators" heading
- ✅ See "Create Teleoperator" button
- ✅ See empty list or existing teleoperators
- ✅ No console errors

**Status:** ⬜ Not tested

---

### 5. Create a Teleoperator

**Steps:**
1. Click "Create Teleoperator" button
2. Fill in the form:
   - Email: `teleoperator1@demo.com`
   - Display Name: `Test Teleoperator 1`
   - Partner Organization ID: `demo-org`
   - Phone: `+1 (555) 111-2222` (optional)
   - Status: `offline` (default)
3. Click "Create"

**Expected:**
- ✅ Form submits successfully
- ✅ Toast notification appears: "Teleoperator created: {uuid}"
- ✅ New teleoperator appears in the list
- ✅ No console errors
- ✅ Firebase Auth user created
- ✅ Firestore document created

**Status:** ⬜ Not tested

---

### 6. Verify Teleoperator in List

**Expected:**
- ✅ New teleoperator appears in the list
- ✅ Email is displayed correctly
- ✅ Display name is displayed correctly
- ✅ Status dropdown works (Available/Busy/Offline/On Break)
- ✅ Can update status

**Status:** ⬜ Not tested

---

### 7. Check Browser Console

**Expected:**
- ✅ No errors in console
- ✅ No warnings about missing components
- ✅ No Firebase permission errors
- ✅ No network errors (404, 500, etc.)

**Status:** ⬜ Not tested

---

## 🐛 Troubleshooting

If any test fails:

1. **Check Server Logs**
   - Look for errors in the terminal where `npm run dev` is running
   - Check for Firebase connection errors
   - Check for missing environment variables

2. **Check Browser Console**
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

3. **Verify Environment Variables**
   ```bash
   # Test endpoint
   curl http://localhost:3000/api/test-firebase/env
   ```

4. **Verify Test Data**
   ```bash
   # Re-run setup
   npm run setup:test
   ```

5. **Check Firebase Console**
   - Verify user exists: Firebase Console → Authentication → Users
   - Verify Firestore data: Firebase Console → Firestore Database
   - Check Firestore rules are deployed

## ✅ Success Criteria

All tests pass when:
- ✅ `npm run dev` starts without errors
- ✅ `/api/test-connection` returns success
- ✅ Can log in with `admin@demo.com`
- ✅ Can navigate to `/admin/teleoperators`
- ✅ Can create a teleoperator
- ✅ Teleoperator appears in the list
- ✅ No console errors

## 📝 Notes

- Custom claims are cached in the Firebase Auth token. If you change claims, you may need to sign out and sign back in.
- The test data script is idempotent - you can run it multiple times safely.
- All test data uses the `demo-org` partner organization.

