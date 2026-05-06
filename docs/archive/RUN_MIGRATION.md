# How to Run the Organizations Migration

## Step 1: Wait for Deployment

Make sure your latest code is deployed to Vercel. Check:
- ✅ Vercel dashboard shows deployment is "Ready"
- ✅ Latest commit `a884b48` is deployed

## Step 2: Get Your Deployment URL

Find your Vercel deployment URL:
- Check Vercel dashboard → Your project → Settings → Domains
- Or use your production URL (e.g., `supervolcano-teleops.vercel.app`)

## Step 3: Run the Migration

### Option A: Via Browser (Easiest)

1. **Open your browser**
2. **Navigate to:**
   ```
   https://YOUR_DEPLOYMENT_URL/api/admin/migrate/add-organizations
   ```
   
   Replace `YOUR_DEPLOYMENT_URL` with your actual Vercel URL

3. **You should see JSON output** showing migration results:
   ```json
   {
     "success": true,
     "message": "Organizations migration completed",
     "stats": {
       "organizationsCreated": 2,
       "usersUpdated": 5,
       "locationsUpdated": 3,
       "errors": []
     }
   }
   ```

### Option B: Via cURL (Terminal)

```bash
curl https://YOUR_DEPLOYMENT_URL/api/admin/migrate/add-organizations
```

### Option C: Via Browser Console (If Authenticated)

1. **Go to your admin portal:** `https://YOUR_DEPLOYMENT_URL/admin`
2. **Open browser DevTools (F12)**
3. **Go to Console tab**
4. **Paste and run:**

```javascript
fetch('/api/admin/migrate/add-organizations')
  .then(res => res.json())
  .then(data => {
    console.log('✅ Migration Result:', data);
    if (data.success) {
      console.log('\n📊 Statistics:');
      console.log('Organizations created:', data.stats.organizationsCreated);
      console.log('Users updated:', data.stats.usersUpdated);
      console.log('Locations updated:', data.stats.locationsUpdated);
      if (data.stats.errors.length > 0) {
        console.log('\n⚠️ Errors:', data.stats.errors);
      }
    }
  })
  .catch(err => console.error('❌ Error:', err));
```

## What the Migration Does

1. ✅ Creates default organizations:
   - `sv:internal` - SuperVolcano Internal
   - `oem:demo-org` - Demo Robotics Company

2. ✅ Migrates user organizationIds:
   - Updates all users to use prefixed format
   - Maps existing IDs to new format

3. ✅ Migrates location organizationIds:
   - Updates all locations to use prefixed format
   - Creates location owner organizations as needed

## Expected Output

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

## Verify Migration Success

### 1. Check Firestore Console

1. Go to Firebase Console → Firestore Database
2. Check `organizations` collection exists with:
   - `sv:internal`
   - `oem:demo-org`
   - Any created location owner organizations

3. Check `users` collection:
   - Users should have prefixed `organizationId` (e.g., `oem:demo-org`)

4. Check `locations` collection:
   - Locations should have matching prefixed `organizationId`

### 2. Test the UI

1. **Go to `/admin/users`**
2. **Click "Create User"**
3. **Select "Field Operator"**
4. **Should see type selector** (OEM vs Property Cleaner)
5. **Select organization from dropdown** ✅

## Troubleshooting

### "Unauthorized" Error
- The migration endpoint doesn't require auth (it's a GET endpoint)
- If you get unauthorized, check the endpoint URL is correct

### "404 Not Found"
- Make sure deployment is complete
- Check the endpoint path: `/api/admin/migrate/add-organizations`
- Verify the file exists in your deployment

### Errors in Migration Stats
- Check `data.stats.errors` array
- Common issues:
  - Missing Firestore permissions (shouldn't happen with Admin SDK)
  - Network timeouts
  - Invalid data format

### Migration Runs But Organizations Not Created
- Check Firestore Console directly
- Verify you're looking at the correct Firebase project
- Check Firestore security rules allow writes

## Clean Up After Migration

Once migration is verified successful, you can delete the migration endpoint:

```bash
rm src/app/api/admin/migrate/add-organizations/route.ts
git add -A
git commit -m "chore: Remove organizations migration endpoint (completed)"
git push
```

## Next Steps

After successful migration:

1. ✅ Test organization dropdowns work
2. ✅ Verify test cleaner can be assigned
3. ✅ Create a new user and test all roles
4. ✅ Delete migration endpoint for security

