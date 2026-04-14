# Vercel Environment Variables Setup

## ✅ Status

All Firebase client environment variables are **already in `.env.local`**. They just need to be added to Vercel.

## Quick Setup (Recommended)

### Option 1: Via Vercel Dashboard (Easiest)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **supervolcano-teleops** (or your project name)
3. Go to **Settings** → **Environment Variables**
4. Add each variable below for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyBJd8_A8tH6e2S5WhgwHqoeXIB58WQWDvw
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = super-volcano-oem-portal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = super-volcano-oem-portal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = super-volcano-oem-portal.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 243745387315
NEXT_PUBLIC_FIREBASE_APP_ID = 1:243745387315:web:88448a0ee710a8fcc2c446
```

5. Click **Save** for each variable
6. **Redeploy** your project (or wait for next deployment)

### Option 2: Via Vercel CLI

If you have Vercel CLI installed:

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project (if not already linked)
cd supervolcano-teleoperator-portal
vercel link

# Run the setup script
./scripts/add-vercel-env.sh
```

Or add manually:

```bash
# For each variable, run:
echo "value" | vercel env add VARIABLE_NAME production
echo "value" | vercel env add VARIABLE_NAME preview
echo "value" | vercel env add VARIABLE_NAME development
```

## Variables to Add

Copy and paste these into Vercel:

| Variable Name | Value |
|--------------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyBJd8_A8tH6e2S5WhgwHqoeXIB58WQWDvw` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `super-volcano-oem-portal.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `super-volcano-oem-portal` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `super-volcano-oem-portal.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `243745387315` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:243745387315:web:88448a0ee710a8fcc2c446` |

## After Adding Variables

1. **Redeploy** your project:
   - Go to Vercel Dashboard → Your Project → **Deployments**
   - Click **⋯** (three dots) on latest deployment → **Redeploy**

2. **Or trigger a new deployment** by pushing a commit:
   ```bash
   git commit --allow-empty -m "Trigger redeploy for env vars"
   git push
   ```

## Verification

After redeploying, test the upload functionality:

1. Go to Admin → Locations → Select a location
2. Click "Add Task"
3. Try uploading a video file
4. Check browser console for any Firebase errors
5. Verify file appears in Firebase Storage

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Variables not set in Vercel
- Wrong environment selected (make sure Production/Preview/Development all have the vars)
- Need to redeploy after adding variables

### Variables not working
- Make sure variable names start with `NEXT_PUBLIC_` (required for client-side access)
- Check that you added to all three environments (Production, Preview, Development)
- Redeploy after adding variables

