# 🚀 Quick Deploy to Vercel

## ✅ Status: TypeScript Errors Fixed!

All TypeScript compilation errors have been fixed. Ready for deployment.

## Deployment Options

### Option 1: Vercel Dashboard (Easiest - Recommended)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Import Project**
   - Click **"Add New..."** → **"Project"**
   - Connect your Git repository (GitHub/GitLab/Bitbucket)
   - OR click **"Import Git Repository"** and paste your repo URL

3. **Configure Project**
   - Framework: Next.js (auto-detected)
   - Root Directory: Leave empty or set to `supervolcano-teleoperator-portal` if deploying from parent repo
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Add Environment Variables** (See below for list)

5. **Deploy!**

### Option 2: Vercel CLI

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Navigate to project
cd supervolcano-teleoperator-portal

# 3. Login
vercel login

# 4. Deploy
vercel --prod
```

## Required Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

### Firebase Client (Public)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBJd8_A8tH6e2S5WhgwHqoeXIB58WQWDvw
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=super-volcano-oem-portal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=super-volcano-oem-portal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=super-volcano-oem-portal.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=243745387315
NEXT_PUBLIC_FIREBASE_APP_ID=1:243745387315:web:88448a0ee710a8fcc2c446
```

### Firebase Admin (Server-side - SECRET)
```
FIREBASE_ADMIN_PROJECT_ID=super-volcano-oem-portal
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account-email@super-volcano-oem-portal.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**⚠️ Important:** Get `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` from your Firebase service account JSON file.

## Quick Steps

1. ✅ Code is ready (TypeScript errors fixed)
2. ⏭️ Add environment variables in Vercel
3. ⏭️ Deploy via Dashboard or CLI
4. ⏭️ Test the deployment

## Notes

- If build times out, Vercel will retry automatically
- First deploy may take longer (5-10 minutes)
- Subsequent deploys are faster
- Check build logs in Vercel dashboard if issues occur

## Post-Deployment

1. Test login at `/login`
2. Test admin portal at `/admin`
3. Test user management at `/admin/users`
4. Verify all environment variables are working

---

**Ready to deploy!** 🎉

