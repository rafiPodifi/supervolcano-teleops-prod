# Deploy to Vercel - Quick Guide

## Prerequisites

1. ✅ Vercel account (sign up at https://vercel.com if needed)
2. ✅ Project code ready
3. ✅ All environment variables documented

## Deployment Methods

### Method 1: Via Vercel Dashboard (Recommended for First Deploy)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Sign in or create an account

2. **Import Your Project**
   - Click **"Add New..."** → **"Project"**
   - Import from GitHub/GitLab/Bitbucket (if repo is connected)
   - OR click **"Import Git Repository"** and paste your repo URL
   - OR click **"Browse"** and upload a ZIP of your project

3. **Configure Project**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `supervolcano-teleoperator-portal` (if deploying from parent directory)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install`

4. **Add Environment Variables**
   - Click **"Environment Variables"** section
   - Add all variables listed below for **Production**, **Preview**, and **Development**
   - Important: Make sure to add them to ALL three environments

5. **Deploy**
   - Click **"Deploy"**
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Method 2: Via Vercel CLI

```bash
# 1. Install Vercel CLI globally (if not already installed)
npm i -g vercel

# 2. Navigate to project directory
cd supervolcano-teleoperator-portal

# 3. Login to Vercel
vercel login

# 4. Link to existing project or create new one
vercel link
# OR deploy directly:
vercel

# 5. Follow prompts:
#   - Set up and deploy? Y
#   - Which scope? (your account)
#   - Link to existing project? N (first time) or Y (if exists)
#   - Project name? supervolcano-teleoperator-portal
#   - Directory? ./
#   - Override settings? N

# 6. Add environment variables (see below)

# 7. Deploy to production
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

### Firebase Admin (Server-side Only) ⚠️ SECRET
```
FIREBASE_ADMIN_PROJECT_ID=super-volcano-oem-portal
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@super-volcano-oem-portal.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**⚠️ Important for FIREBASE_ADMIN_PRIVATE_KEY:**
- Get the private key from your Firebase service account JSON file
- Keep the literal `\n` characters (don't convert to actual newlines)
- Wrap the entire value in double quotes
- Example format: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n"`

### Optional Variables
```
FIRESTORE_DATABASE_ID=default
ADMIN_BEARER_TOKEN=your-secret-token-if-used
```

### Add Variables via CLI

```bash
# For each variable:
vercel env add VARIABLE_NAME production
vercel env add VARIABLE_NAME preview
vercel env add VARIABLE_NAME development

# Example:
echo "super-volcano-oem-portal" | vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production preview development

# For secrets (private key), you'll be prompted to paste:
vercel env add FIREBASE_ADMIN_PRIVATE_KEY production preview development
```

## Quick Deploy Script

```bash
# Make script executable
chmod +x scripts/deploy-vercel.sh

# Run deployment
./scripts/deploy-vercel.sh
```

## Post-Deployment Checklist

After deployment, verify:

- [ ] Application loads at `https://your-project.vercel.app`
- [ ] Login page works
- [ ] Authentication succeeds
- [ ] Admin portal accessible at `/admin`
- [ ] User management page works at `/admin/users`
- [ ] No console errors
- [ ] Environment variables are set correctly

## Troubleshooting

### Build Fails

**Error: Missing environment variables**
- Check all variables are added to Vercel
- Make sure variables are added to Production environment
- Redeploy after adding variables

**Error: TypeScript errors**
- Run `npm run build` locally first
- Fix any TypeScript errors
- Commit and push fixes

**Error: Module not found**
- Check `package.json` dependencies
- Run `npm install` locally to verify
- Check for missing imports

### Runtime Errors

**Error: Firebase not initialized**
- Check `NEXT_PUBLIC_FIREBASE_*` variables are set
- Verify variable names match exactly
- Check browser console for specific errors

**Error: Admin SDK not working**
- Check `FIREBASE_ADMIN_*` variables are set
- Verify private key format (with `\n` characters)
- Check server logs in Vercel dashboard

### Quick Fixes

```bash
# Redeploy after env var changes
vercel --prod

# Check deployment logs
vercel logs

# View environment variables
vercel env ls
```

## Production Settings

### Recommended Vercel Settings

1. **Build & Development Settings**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
   - Development Command: `npm run dev`

2. **Framework Preset**: Next.js

3. **Node Version**: 18.x or 20.x (check in `package.json`)

4. **Auto-deploy**: Enable for main branch

5. **Production Branch**: `main` or `master`

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL certificate auto-provisions

## Monitoring

- Check Vercel Dashboard → Analytics for performance
- Check Vercel Dashboard → Logs for errors
- Set up error tracking (Sentry, etc.)

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Next.js on Vercel: https://vercel.com/docs/frameworks/nextjs
- Vercel Support: https://vercel.com/support

