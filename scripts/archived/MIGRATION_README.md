# Migration Guide: properties → locations

This migration script updates your Firebase database to use the new collection and field naming conventions.

## What Gets Migrated

1. **Collections:**
   - `properties` → `locations`
   - `propertyNotes` → `locationNotes`

2. **Fields:**
   - `propertyId` → `locationId` (in tasks, sessions, notes)

3. **Storage Paths:**
   - `/properties/` → `/locations/` (requires manual review)

## Prerequisites

1. Install `tsx` for running TypeScript files:
   ```bash
   npm install -D tsx
   ```

2. Ensure your service account JSON file is accessible:
   - The script looks for: `../super-volcano-oem-portal-firebase-adminsdk-fbsvc-9afc946529.json`
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

## Running the Migration

### Option 1: Using npm script
```bash
npm run migrate:locations
```

### Option 2: Direct execution
```bash
npx tsx scripts/migrate-to-locations.ts
```

### Option 3: Deploy as Cloud Function (recommended for production)

1. Create a Cloud Function that calls `migratePropertiesToLocations()`
2. Deploy and invoke once
3. Delete the function after migration

## What the Script Does

1. **Copies** all documents from `properties` → `locations` (doesn't delete originals)
2. **Updates** all `tasks` documents: adds `locationId` field (keeps `propertyId` for backward compat)
3. **Updates** all `sessions` documents: adds `locationId` field
4. **Migrates** `propertyNotes` → `locationNotes` with field updates
5. **Reports** statistics and any errors

## Important Notes

⚠️ **The script does NOT delete old collections** - you must do this manually after verifying everything works!

⚠️ **Storage paths** need manual migration - the script only reports this

⚠️ **Backward compatibility** - The code includes fallbacks (`doc.locationId ?? doc.propertyId`), so you can migrate gradually

## After Migration

1. **Verify** all data migrated correctly
2. **Test** your application thoroughly
3. **Deploy** updated Firestore rules and indexes
4. **Delete** old collections (only after confirming everything works):
   - `properties` collection
   - `propertyNotes` collection

## Rollback

If something goes wrong:
- The old `properties` collection still exists
- The code has backward compatibility fallbacks
- You can revert the code changes if needed

## Safety Features

- Uses Firestore batches (max 500 operations)
- Error handling for each document
- Detailed error reporting
- Does NOT delete original data
- Idempotent (safe to run multiple times)

