# Post-Migration Checklist

## ✅ Step 1: Verify Migration Success

### Check the Migration Output

You should have seen JSON output like:
```json
{
  "success": true,
  "message": "Organizations migration completed",
  "stats": {
    "organizationsCreated": 2,
    "usersUpdated": 8,
    "locationsUpdated": 5,
    "errors": []
  }
}
```

**If you see `"success": true` and `"errors": []` → ✅ Migration successful!**

**If you see errors in the `errors` array → ⚠️ Check what failed**

## ✅ Step 2: Verify in Firestore Console

1. **Go to Firebase Console:**
   - https://console.firebase.google.com
   - Select your project

2. **Check `organizations` collection:**
   - Open Firestore Database
   - Look for `organizations` collection
   - Should see at least:
     - `sv:internal` - SuperVolcano Internal
     - `oem:demo-org` - Demo Robotics Company

3. **Check `users` collection:**
   - Open a user document
   - Verify `organizationId` field exists
   - Should be prefixed format (e.g., `oem:demo-org`, `owner:org-XXXXX`)
   - ✅ NOT plain UUIDs or slugs

4. **Check `locations` collection:**
   - Open a location document
   - Verify `organizationId` matches users
   - Should be prefixed format

## ✅ Step 3: Test the New Organization Dropdowns

### Test 1: Create a New User

1. **Go to your admin portal:**
   ```
   https://YOUR_DEPLOYMENT_URL/admin/users
   ```

2. **Click "Create User" button**

3. **Select different roles and verify dropdowns:**

   **Admin Role:**
   - Select "Admin" or "Super Admin"
   - ✅ Should show "SuperVolcano Internal" (disabled, auto-selected)
   
   **Partner Manager:**
   - Select "Partner Manager"
   - ✅ Should show dropdown with OEM organizations
   - ✅ Should include "Demo Robotics Company"
   
   **Location Owner:**
   - Select "Location Owner"
   - ✅ Should show dropdown with location owner organizations
   
   **Field Operator:**
   - Select "Field Operator"
   - ✅ Should show type selector (OEM Teleoperator vs Property Cleaner)
   - ✅ After selecting type, should show appropriate organizations

### Test 2: Edit Existing User

1. **Go to `/admin/users`**
2. **Click "Edit" on any user**
3. **Verify organization dropdown appears** (instead of text input)
4. **Try changing organization** (if role allows)
5. **Save and verify changes**

## ✅ Step 4: Fix Test Cleaner Assignment

If test cleaner still has issues:

1. **Go to `/admin/users`**
2. **Find test cleaner user** (search for `testcleaner@supervolcano.com`)
3. **Click "Edit"**
4. **Verify:**
   - Role: `field_operator`
   - Organization ID: Should be prefixed (e.g., `owner:org-XXXXX`)
5. **If wrong, use dropdown to select correct organization**
6. **Click "Save Changes"**

### Verify Assignment Works

1. **Go to `/admin/locations`** (or locations page)
2. **Find a location that matches test cleaner's organizationId**
3. **Click "Assign Cleaners" or similar**
4. **Test cleaner should appear in the list** ✅

## ✅ Step 5: Test Organization Filtering

### Test Cleaner Assignment Filtering

The assignment modal should now:
- ✅ Only show cleaners with matching `organizationId`
- ✅ Filter out cleaners from other organizations
- ✅ Test cleaner appears if location's org matches

## ✅ Step 6: Clean Up (Optional)

Once everything is verified working, you can delete the migration endpoint:

```bash
cd "/Users/chris/Desktop/Super Volcano OEM Partner Portal/supervolcano-teleoperator-portal"
rm src/app/api/admin/migrate/add-organizations/route.ts
git add -A
git commit -m "chore: Remove organizations migration endpoint (completed)"
git push
```

**⚠️ Only do this AFTER verifying everything works!**

## 🐛 Troubleshooting

### Dropdown shows "Loading organizations..."
- Check browser console for errors
- Verify `/api/admin/organizations` endpoint is accessible
- Check that organizations collection exists in Firestore

### "No organizations available"
- Verify organizations were created (check Firestore)
- Check API endpoint returns organizations
- Verify user has admin role

### Test cleaner still doesn't appear
1. Verify test cleaner has `organizationId` set in Firestore
2. Verify location has matching `organizationId`
3. Check both use prefixed format (e.g., `owner:org-XXXXXXXX`)
4. Check browser console for API errors

### Validation errors
- Prefixed IDs are accepted: `sv:internal`, `oem:slug`, `owner:slug`
- UUIDs are still accepted (backward compatibility)
- Slugs are still accepted (backward compatibility)

## 📊 Migration Statistics

Check your migration output for:
- `organizationsCreated` - How many organizations were created
- `usersUpdated` - How many users were migrated
- `locationsUpdated` - How many locations were migrated
- `errors` - Any errors that occurred (should be empty)

## ✅ Success Criteria

Migration is successful when:
- ✅ Organizations collection exists in Firestore
- ✅ Default organizations created (`sv:internal`, `oem:demo-org`)
- ✅ Users have prefixed organizationIds
- ✅ Locations have prefixed organizationIds
- ✅ Organization dropdowns work in Create/Edit User
- ✅ Test cleaner can be assigned to locations
- ✅ No errors in migration output

