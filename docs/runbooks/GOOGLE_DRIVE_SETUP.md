# Google Drive Sync Setup

This guide explains how to configure Google Drive API access for syncing folder statistics in the Data Intelligence dashboard.

## Overview

The Google Drive sync feature allows administrators to:
- Connect Google Drive folders containing video files
- Automatically scan folders and subfolders recursively
- Track video counts, storage size, and estimated hours
- Sync folder statistics to the Data Intelligence dashboard

## Prerequisites

- A Google Cloud Platform (GCP) project
- Admin access to the GCP project
- Access to Google Drive folders you want to sync

## Step 1: Create a Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Fill in the details:
   - **Service account name**: `supervolcano-drive-sync` (or your preferred name)
   - **Service account ID**: Auto-generated
   - **Description**: "Service account for Google Drive folder sync"
6. Click **Create and Continue**
7. Skip role assignment (not needed for Drive API access)
8. Click **Done**

## Step 2: Create and Download Service Account Key

1. In the Service Accounts list, click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create** (the JSON file will download automatically)
6. **Important**: Save this file securely - you'll need the `client_email` and `private_key` values

## Step 3: Enable Google Drive API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click on **Google Drive API**
4. Click **Enable**
5. Wait for the API to be enabled (usually takes a few seconds)

## Step 4: Share Drive Folders with Service Account

1. Open the downloaded JSON key file
2. Copy the `client_email` value (it looks like: `supervolcano-drive-sync@project-id.iam.gserviceaccount.com`)
3. In Google Drive, navigate to the folder you want to sync
4. Right-click the folder → **Share**
5. Paste the service account email in the "Add people and groups" field
6. Set permission to **Viewer** (read-only access is sufficient)
7. Uncheck "Notify people" (service accounts don't need notifications)
8. Click **Share**
9. Repeat for any other folders you want to sync

**Note**: For Shared Drives (Google Workspace), you may need to:
- Add the service account as a member of the Shared Drive
- Grant "Viewer" or "Content Manager" access at the Shared Drive level

## Step 5: Extract Environment Variables

From the downloaded JSON key file, extract:

1. **`client_email`**: The service account email
2. **`private_key`**: The private key (includes `\n` characters for newlines)

Example JSON structure:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "supervolcano-drive-sync@your-project-id.iam.gserviceaccount.com",
  ...
}
```

## Step 6: Configure Environment Variables

### For Local Development

Create or update `.env.local` in the project root:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=supervolcano-drive-sync@your-project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Important Notes:**
- The private key must be wrapped in quotes
- The `\n` characters in the private key must be preserved (they represent newlines)
- Do NOT commit `.env.local` to version control

### For Vercel Deployment

1. Go to your [Vercel project dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add the following variables:

   **Variable 1:**
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - **Value:** `supervolcano-drive-sync@your-project-id.iam.gserviceaccount.com`
   - **Environment:** Production, Preview, Development (select all)
   - Click **Save**

   **Variable 2:**
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - **Value:** `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n`
     - Copy the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
     - Include all `\n` characters (they will be converted to actual newlines)
   - **Environment:** Production, Preview, Development (select all)
   - Click **Save**

5. **Redeploy** your application for the changes to take effect

## Step 7: Get Folder ID from Google Drive

To sync a folder, you'll need its Folder ID:

1. Open Google Drive in your browser
2. Navigate to the folder you want to sync
3. Open the folder
4. Look at the URL in your browser
5. The Folder ID is the long string after `/folders/` in the URL

Example URL:
```
https://drive.google.com/drive/folders/1ABC123xyz789DEF456ghi012JKL345mno678PQR
```

The Folder ID is: `1ABC123xyz789DEF456ghi012JKL345mno678PQR`

## Step 8: Using the Sync Feature

1. Navigate to the **Data Intelligence** dashboard (`/admin`)
2. Scroll to the **Data Sources** section
3. Click **Add Drive Folder**
4. Enter:
   - **Folder ID**: The ID from Step 7
   - **Source Name**: A descriptive name (e.g., "Training Videos Q4 2024")
5. Click **Add & Sync**
6. The system will:
   - Verify folder access
   - Recursively scan all subfolders
   - Count video files and calculate total size
   - Estimate hours based on storage (15 GB/hour for 1080p 30fps)
   - Save statistics to Firestore

## Troubleshooting

### "Cannot access folder" Error

**Problem:** The API returns an error saying the folder cannot be accessed.

**Solutions:**
1. Verify the service account email has been shared with the folder
2. Check that the folder is shared with **Viewer** access or higher
3. For Shared Drives, ensure the service account is a member of the Shared Drive
4. Verify the Folder ID is correct (copy from the URL, not the folder name)

### "Invalid credentials" Error

**Problem:** Authentication fails when calling the API.

**Solutions:**
1. Verify `GOOGLE_SERVICE_ACCOUNT_EMAIL` matches the `client_email` from the JSON key
2. Check that `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` includes:
   - The full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
   - All `\n` characters preserved
   - Wrapped in quotes in `.env.local`
3. In Vercel, ensure the private key is set correctly (newlines should be preserved)
4. Restart your development server after updating `.env.local`

### "API not enabled" Error

**Problem:** Google Drive API is not enabled for the project.

**Solutions:**
1. Go to Google Cloud Console → **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Ensure it shows "Enabled" (if not, click **Enable**)

### Sync Takes Too Long

**Problem:** Large folders with many subfolders take a long time to sync.

**Solutions:**
- This is expected for large folder structures
- The API has a 60-second timeout (`maxDuration: 60`)
- For very large folders, consider:
  - Breaking them into smaller folders
  - Syncing only specific subfolders
  - Running syncs during off-peak hours

### Private Key Format Issues

**Problem:** The private key doesn't work even though it looks correct.

**Solutions:**
1. Ensure the private key includes the header and footer:
   ```
   -----BEGIN PRIVATE KEY-----
   ...
   -----END PRIVATE KEY-----
   ```
2. In `.env.local`, wrap the entire key in double quotes
3. In Vercel, paste the key exactly as it appears in the JSON file
4. The code automatically handles `\n` conversion, so don't manually replace them

## Security Best Practices

1. **Never commit credentials to version control**
   - Add `.env.local` to `.gitignore`
   - Use Vercel environment variables for production

2. **Limit service account permissions**
   - Only grant Viewer access to folders
   - Don't grant the service account any IAM roles it doesn't need

3. **Rotate keys periodically**
   - Create new keys and update environment variables
   - Delete old keys from Google Cloud Console

4. **Monitor API usage**
   - Check Google Cloud Console → **APIs & Services** → **Dashboard**
   - Set up billing alerts if needed

## API Limits

- **Quota**: Google Drive API has default quotas (check your project's quotas)
- **Rate Limits**: The API may throttle requests for very large folders
- **Timeout**: The sync endpoint has a 60-second timeout

## Support

For issues or questions:
1. Check the browser console for error messages
2. Check server logs (Vercel logs or local terminal)
3. Verify all environment variables are set correctly
4. Ensure the service account has proper access to folders

