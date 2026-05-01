# Google Maps API Setup

## API Key Configuration

Your Google Maps API key has been provided. To use it in this Next.js application, you need to add it to your environment variables.

### For Local Development

Create or update `.env.local` in the project root:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyC3BaCgT_SgHWb7X6myyjWu-za6BaQ7iTM
```

**Important:** Next.js requires the `NEXT_PUBLIC_` prefix for client-side environment variables.

### For Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value:** `AIzaSyC3BaCgT_SgHWb7X6myyjWu-za6BaQ7iTM`
   - **Environment:** Production, Preview, Development (select all)
4. Click **Save**
5. Redeploy your application

### API Key Restrictions (Recommended)

For security, configure API key restrictions in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your API key
3. Under **Application restrictions**, choose:
   - **HTTP referrers (web sites)** for web apps
   - Add your domain(s): `*.vercel.app`, `localhost:3000`, etc.
4. Under **API restrictions**, restrict to:
   - **Places API** (for autocomplete)
   - **Maps JavaScript API** (if using maps)

### Verify Setup

After adding the environment variable:

1. Restart your development server (`npm run dev`)
2. Navigate to a location detail page
3. Click "Create Task"
4. The address field should show Google Places autocomplete suggestions

### Troubleshooting

**If autocomplete doesn't work:**

1. Check browser console for errors
2. Verify the environment variable is set: `console.log(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)`
3. Ensure the API key has Places API enabled
4. Check API key restrictions aren't blocking your domain
5. Verify billing is enabled in Google Cloud Console (Places API requires billing)

**Note:** The component will fall back to manual address entry if the API key is not configured, so the form will still work without it.



