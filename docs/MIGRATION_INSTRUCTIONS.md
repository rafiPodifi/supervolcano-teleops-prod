# Migration Instructions - Remove partnerId

## ✅ What's Been Done

1. ✅ Migration endpoint created: `/api/admin/migrate/remove-partner-id`
2. ✅ Migration secret generated: `e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=`
3. ✅ Secret added to `.env.local`
4. ✅ Code committed and pushed to GitHub
5. ⏳ Vercel deployment in progress...

## 🔐 Step 1: Add Migration Secret to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to: https://vercel.com/dashboard
2. Find your project: `supervolcano-teleoperator-portal`
3. Go to: **Settings** → **Environment Variables**
4. Click **Add New**
5. Add the following:
   - **Key:** `MIGRATION_SECRET_KEY`
   - **Value:** `e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**
6. **Redeploy** your application (Go to Deployments → Click the latest deployment → Redeploy)

### Option B: Via Vercel CLI (If you have it installed)

```bash
vercel env add MIGRATION_SECRET_KEY production
# When prompted, paste: e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=
```

## ⏱️ Step 2: Wait for Deployment

- Check Vercel dashboard for deployment status
- Wait until deployment is complete (~2-3 minutes)
- Note your deployment URL (e.g., `https://supervolcano-teleops.vercel.app`)

## 🚀 Step 3: Run the Migration

### Option A: Using cURL (Recommended)

Replace `YOUR_DEPLOYMENT_URL` with your actual Vercel URL:

```bash
curl -X POST https://YOUR_DEPLOYMENT_URL/api/admin/migrate/remove-partner-id \
  -H "x-migration-key: e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=" \
  -H "Content-Type: application/json"
```

### Option B: Using Browser Console

1. **Open your deployed app** (e.g., `https://supervolcano-teleops.vercel.app/admin`)
2. **Open DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Paste this code:**

```javascript
fetch('/api/admin/migrate/remove-partner-id', {
  method: 'POST',
  headers: {
    'x-migration-key': 'e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ MIGRATION RESULT:', data);
  
  if (data.success) {
    console.log('\n📊 STATISTICS:');
    console.log('Duration:', data.stats.duration);
    console.log('Users updated:', data.stats.users.updated, '/', data.stats.users.processed);
    console.log('Locations updated:', data.stats.locations.updated, '/', data.stats.locations.processed);
    console.log('Auth updated:', data.stats.auth.updated, '/', data.stats.auth.processed);
    console.log('Organizations mapped:', data.stats.organizationsMapped);
    
    if (data.stats.errors.length > 0) {
      console.log('\n🔴 ERRORS:');
      data.stats.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.collection}/${err.id}: ${err.error}`);
      });
    } else {
      console.log('\n✅ NO ERRORS!');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('Next: Delete the migration endpoint for security');
  } else {
    console.error('❌ Migration failed:', data.error);
  }
})
.catch(err => {
  console.error('❌ Request failed:', err);
});
```

5. **Press Enter** and watch the console output

## ✅ Step 4: Verify Migration Success

### Check in Admin Portal

1. Go to: `/admin/users`
2. Find: `testcleaner@supervolcano.com`
3. Click **Edit**
4. Verify:
   - ✅ Sync status shows **"Synced"** (green check)
   - ✅ **Organization ID** is populated
   - ✅ **NO Partner ID field** visible

### Check Test Cleaner Assignment

1. Go to: `/admin/locations`
2. Select any location
3. Click **Assign Cleaner**
4. Verify: **Test cleaner appears in the list**

### Check Firebase Console

1. Go to: Firebase Console → Firestore Database
2. Open `users` collection
3. Select any user document
4. Verify:
   - ✅ Has `organizationId` field
   - ✅ NO `partnerId` field

## 🧹 Step 5: Clean Up (IMPORTANT!)

Once migration is verified successful:

### Delete Migration Endpoint

```bash
cd supervolcano-teleoperator-portal
rm src/app/api/admin/migrate/remove-partner-id/route.ts
git add -A
git commit -m "chore: Remove one-time migration endpoint (completed)"
git push
```

### Remove Migration Secret from Vercel

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Find `MIGRATION_SECRET_KEY`
3. Click **Delete**
4. Confirm deletion

### Remove from Local .env.local (Optional)

```bash
# Remove the migration secret line from .env.local
# (Keep the file, just remove the MIGRATION_SECRET_KEY line)
```

## 🎯 Expected Migration Output

When successful, you should see:

```
✅ MIGRATION RESULT: {
  success: true,
  message: "Migration completed successfully",
  stats: {
    duration: "15.32s",
    users: { processed: 8, updated: 8 },
    locations: { processed: 12, updated: 12 },
    auth: { processed: 8, updated: 8 },
    organizationsMapped: 2,
    errors: []
  }
}
```

## ❌ Troubleshooting

### "Unauthorized - Invalid migration key"
- ✅ Check that `MIGRATION_SECRET_KEY` is set in Vercel environment variables
- ✅ Redeploy after adding the env var
- ✅ Make sure you're using the exact secret: `e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=`

### "Migration secret not configured"
- ✅ You forgot to set `MIGRATION_SECRET_KEY` in Vercel
- ✅ Add it in Vercel dashboard and **redeploy**

### Migration runs but has errors
- ✅ Check `data.stats.errors` array in response
- ✅ Common issues: Firestore permissions, missing organizations collection

### Can't access the endpoint
- ✅ Make sure deployment completed
- ✅ Try accessing `/api/admin/migrate/remove-partner-id` with GET first (should return endpoint info)

## 📋 Migration Secret

**Keep this secure!** The migration secret is:

```
e4sSkPDbhIycFZyCdPxBnrRRnp8NHZst0Ur9vFI/Aks=
```

This secret is only needed to run the migration once. Delete it from Vercel after migration is complete.

