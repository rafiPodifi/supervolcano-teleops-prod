# How to Find the setDoc Write Request in Network Tab

## What You're Seeing

The `channel?VER=8&database=proj...` requests you see are Firestore's **real-time listener connections**. These are for reading data, not writing.

## What to Look For

When `setDoc` is called, you should see a **different type of request**:

### Write Request Characteristics:
- **URL:** Will contain `/documents/locations/` (or your document path)
- **Method:** `PATCH` or `POST` (not `GET`)
- **Status:** Will be `200` (success), `403` (permission denied), `401` (auth), or `pending` (hanging)

### How to Find It:

1. **Clear Network tab** (right-click → Clear)
2. **Filter by:** `documents/locations` (or just `documents`)
3. **Or filter by:** `PATCH` or `POST` method
4. **Try saving a location**
5. **Look for a request with `/documents/locations/` in the URL**

### Expected Write Request:
```
PATCH https://firestore.googleapis.com/v1/projects/super-volcano-oem-portal/databases/(default)/documents/locations/[DOCUMENT_ID]?currentDocument.exists=true&updateMask.fieldPaths=name&updateMask.fieldPaths=partnerOrgId&...
```

Or if it's a create (first time):
```
POST https://firestore.googleapis.com/v1/projects/super-volcano-oem-portal/databases/(default)/documents/locations?documentId=[DOCUMENT_ID]
```

## If No Write Request Appears:

If you don't see a `PATCH` or `POST` request to `/documents/locations/`:
- The SDK isn't sending the write request
- This could mean:
  1. The request is being queued/blocked
  2. There's an SDK bug preventing writes
  3. The connection state is preventing writes

## If Write Request Appears but is "Pending":

- Check the **Response** tab - it might show an error
- Check the **Headers** tab - verify the Authorization header is present
- The request might be hanging due to rules or server issues

## Quick Test:

1. Clear Network tab
2. **Immediately before clicking "Save"**, make sure Network tab is open and recording
3. Click "Save property"
4. **Watch the Network tab in real-time** - you should see the write request appear within 1-2 seconds
5. Check its status immediately

## Alternative: Check Console for Write Request Log

Look in the console for:
```
[repo] createProperty:INITIATING setDoc network request NOW...
```

This should appear just before the write request. The request should appear in Network tab within seconds of this log.

