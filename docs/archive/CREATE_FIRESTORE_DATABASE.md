# Create Firestore Database - REQUIRED!

## The Problem

The error shows:
```
The database (default) does not exist for project super-volcano-oem-portal
```

**This is why nothing is saving!** The Firestore database hasn't been created yet.

## Solution: Create the Database

### Option 1: Use the Direct Link (Easiest)

Click this link to go directly to the setup page:
**https://console.cloud.google.com/datastore/setup?project=super-volcano-oem-portal**

Then:
1. Select **"Cloud Firestore"** (not Datastore)
2. Choose **"Native mode"** (not Datastore mode)
3. Select a **location** (choose the closest to you, e.g., `us-central`, `us-east1`, etc.)
4. Click **"Create Database"**

### Option 2: Via Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select your project: **super-volcano-oem-portal**
3. Click **"Firestore Database"** in the left sidebar
4. Click **"Create database"**
5. Select **"Start in production mode"** (we'll deploy rules after)
6. Choose a **location** (e.g., `us-central`)
7. Click **"Enable"**

### Option 3: Via Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select project: **super-volcano-oem-portal**
3. Go to **"Firestore"** in the left menu (under "Databases")
4. Click **"Create database"**
5. Select **"Native mode"**
6. Choose a **location**
7. Click **"Create"**

## After Creating the Database

1. **Deploy Firestore Rules:**
   - Go to Firebase Console → Firestore Database → Rules tab
   - Paste the rules from `src/firebase/firestore.rules`
   - Click **"Publish"**

2. **Try saving a location again:**
   - The SDK should now work (database exists)
   - If SDK still times out, REST API fallback will work (database exists)

## Why This Happened

Firestore databases must be explicitly created - they don't auto-create when you first use them. The project exists, but the database within it needs to be created.

## Verification

After creating the database, you should be able to:
- See the database in Firebase Console
- Save locations successfully
- See documents appear in the `locations` collection

