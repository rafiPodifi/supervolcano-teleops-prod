# Fix Test Cleaner Instructions

The test cleaner endpoint is deployed at:
```
/api/admin/fix-test-cleaner
```

However, it requires admin authentication. Here are two ways to use it:

## Option 1: Browser Console (While Logged In)

1. **Log into your admin portal** at `https://supervolcano-teleops.vercel.app/admin`
2. **Open Browser DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Paste this code:**

```javascript
// Get auth token from Firebase
const auth = firebase.auth();
const user = auth.currentUser;

if (!user) {
  console.error('❌ Not logged in!');
} else {
  user.getIdToken().then(token => {
    // Call the fix endpoint
    fetch('/api/admin/fix-test-cleaner', {
      method: 'GET',
      headers: {
        'x-firebase-token': token,
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log('✅ Test cleaner fixed!', data);
        console.log('Now refresh the /admin/users page');
      } else {
        console.error('❌ Error:', data.error);
      }
    })
    .catch(err => {
      console.error('❌ Request failed:', err);
    });
  });
}
```

5. **Press Enter**
6. **Check the console output** - should see "✅ Test cleaner fixed!"
7. **Refresh the `/admin/users` page**
8. **Edit test cleaner** - should now show "Synced" status

## Option 2: Direct URL (If Session Cookies Work)

1. **Make sure you're logged into the admin portal**
2. **Visit this URL in the same browser:**
   ```
   https://supervolcano-teleops.vercel.app/api/admin/fix-test-cleaner
   ```
3. **If it works**, you'll see JSON response like:
   ```json
   {
     "success": true,
     "message": "Test cleaner fixed successfully",
     "uid": "..."
   }
   ```
4. **If you get 401 Unauthorized**, use Option 1 instead

## What This Does

The endpoint will:
- ✅ Find test cleaner by email (`testcleaner@supervolcano.com`)
- ✅ Set Auth custom claims: `role: 'field_operator'`, `organizationId: '94c8ed66-46ed-49dd-8d02-c053f2c38cb9'`
- ✅ Update Firestore document with same values
- ✅ Fix the sync mismatch immediately

## After Running

1. **Refresh `/admin/users` page**
2. **Edit test cleaner**
3. **Should show:**
   - ✅ Sync status: "Synced" (green checkmark)
   - ✅ Auth Org ID: `94c8ed66-46ed-49dd-8d02-c053f2c38cb9`
   - ✅ Firestore Org ID: `94c8ed66-46ed-49dd-8d02-c053f2c38cb9`
4. **Save button should now be clickable** ✅

