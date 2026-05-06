# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Ensure your code is pushed to GitHub, GitLab, or Bitbucket
3. **Vercel CLI** (optional): `npm i -g vercel`

## Required Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

### Firebase Client (Public)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Admin (Server-only)
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (keep `\n` characters!)
- `FIRESTORE_DATABASE_ID` (optional, defaults to "default")

### Optional
- `NEXT_PUBLIC_FIRESTORE_DEBUG` (set to "true" for debug logging)

## Deployment Methods

### Method 1: Vercel Dashboard (Recommended)

1. **Import Project**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your Git repository
   - Vercel will auto-detect Next.js

2. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./supervolcano-teleoperator-portal` (if repo is at root)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

3. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables listed above
   - Set for: Production, Preview, and Development

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `your-project.vercel.app`

### Method 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to project directory
cd supervolcano-teleoperator-portal

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

### Method 3: Git Integration (Automatic)

1. **Connect Repository**
   - In Vercel Dashboard, go to Project Settings → Git
   - Connect your GitHub/GitLab/Bitbucket repository
   - Select the repository and branch

2. **Auto-Deploy**
   - Every push to main/master → Production
   - Every pull request → Preview deployment
   - Automatic builds on every commit

## Post-Deployment

### 1. Verify Environment Variables
- Check that all Firebase variables are set correctly
- Test authentication flow
- Verify Firestore connections

### 2. Update Firebase Allowed Domains
- Go to Firebase Console → Authentication → Settings → Authorized domains
- Add your Vercel domain: `your-project.vercel.app`
- Add custom domain if configured

### 3. Test Onboarding Flow
- Visit `/get-started` on your deployed site
- Test signup flow
- Verify video uploads work
- Check Firestore writes

### 4. Monitor Builds
- Check Vercel Dashboard → Deployments
- Review build logs for errors
- Monitor function execution times

## Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Verify all environment variables are set
- Ensure `package.json` has correct build script

### Runtime Errors
- Check Function Logs in Vercel Dashboard
- Verify Firebase Admin credentials are correct
- Ensure `FIREBASE_ADMIN_PRIVATE_KEY` has `\n` characters preserved

### Authentication Issues
- Verify Firebase Auth domain is whitelisted
- Check CORS settings in Firebase Console
- Ensure API keys are correct

### Firestore Connection Issues
- Verify `FIRESTORE_DATABASE_ID` is set correctly
- Check Firestore security rules
- Ensure service account has proper permissions

## Custom Domain Setup

1. **Add Domain in Vercel**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Firebase**
   - Add custom domain to Firebase Authorized domains
   - Update any hardcoded URLs in code

## Cron Jobs

The project includes a cron job configured in `vercel.json`:
- Path: `/api/cron/sync-sql`
- Schedule: Daily at midnight UTC

Ensure this endpoint is accessible and working.

## Security Notes

- Never commit `.env.local` files
- Use Vercel Environment Variables for secrets
- Rotate Firebase Admin keys periodically
- Review Firestore security rules before production

