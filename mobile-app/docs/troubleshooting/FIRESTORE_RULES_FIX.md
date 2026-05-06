# Firestore Rules Fix for Mobile App

## 🔍 ROOT CAUSE IDENTIFIED

Your Firestore rules require **authentication** to read locations:

```javascript
match /locations/{locationId} {
  allow read: if partnerMatches(resource.data.partnerOrgId);  // ← Requires auth!
  allow create, update, delete: if isAdmin();
}
```

The `partnerMatches()` function requires:
1. User to be authenticated (`request.auth != null`)
2. User's `partner_org_id` to match the location's `partnerOrgId`

**The mobile app is NOT authenticated**, so it gets **0 documents** (silently blocked by rules).

---

## ✅ SOLUTION OPTIONS

### Option 1: Allow Unauthenticated Reads (For Testing/Debugging)

**Update your Firestore rules** to temporarily allow unauthenticated reads:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.role == "admin";
    }

    function isOperator() {
      return isAuthenticated() && request.auth.token.role == "operator";
    }

    function partnerMatches(partnerOrgId) {
      return isAdmin() ||
        (isAuthenticated() && request.auth.token.partner_org_id == partnerOrgId);
    }

    function teleoperatorStatusUpdateAllowed() {
      return isOperator() &&
        resource.data.assigned_to == "teleoperator" &&
        request.resource.data.assigned_to == resource.data.assigned_to &&
        request.resource.data.locationId == resource.data.locationId &&
        request.resource.data.partnerOrgId == resource.data.partnerOrgId &&
        request.resource.data.name == resource.data.name &&
        request.resource.data.duration == resource.data.duration &&
        request.resource.data.priority == resource.data.priority &&
        request.resource.data.type == resource.data.type &&
        request.resource.data.assignedToUserId == request.auth.uid &&
        request.resource.data.status in ["in_progress", "completed"] &&
        request.resource.data.state == request.resource.data.status;
    }

    match /organizations/{orgId} {
      allow read: if partnerMatches(orgId);
      allow write: if isAdmin();
    }

    match /users/{userId} {
      allow read: if partnerMatches(resource.data.partnerOrgId);
      allow update: if isAdmin() || request.auth.uid == userId;
      allow create: if isAdmin();
      allow delete: if isAdmin();
    }

    // ✅ CHANGED: Allow unauthenticated reads for mobile app
    match /locations/{locationId} {
      allow read: if true;  // ← Changed from partnerMatches() to allow all reads
      allow create, update, delete: if isAdmin();
    }

    match /taskTemplates/{templateId} {
      allow read: if partnerMatches(resource.data.partnerOrgId);
      allow write: if isAdmin();
    }

    // ✅ CHANGED: Allow unauthenticated reads for mobile app
    match /tasks/{taskId} {
      allow read: if true;  // ← Changed from partnerMatches() to allow all reads
      allow create: if isAdmin();
      allow delete: if isAdmin();
      allow update: if isAdmin() || teleoperatorStatusUpdateAllowed();

      match /media/{mediaId} {
        allow read: if isAuthenticated();
        allow create, update, delete: if isAdmin();
      }
    }

    match /sessions/{sessionId} {
      allow read: if partnerMatches(resource.data.partnerOrgId);
      allow create: if isAdmin() || partnerMatches(request.resource.data.partnerOrgId);
      allow update: if isAdmin() || request.auth.uid == resource.data.operatorId;
      allow delete: if isAdmin();
    }

    match /locationNotes/{noteId} {
      allow read: if partnerMatches(resource.data.partnerOrgId);
      allow create: if isAuthenticated()
        && partnerMatches(request.resource.data.partnerOrgId)
        && request.resource.data.authorId == request.auth.uid
        && request.resource.data.content is string;
      allow delete: if isAdmin() || request.auth.uid == resource.data.authorId;
    }

    match /auditLogs/{document=**} {
      allow read: if isAdmin();
      allow create: if isAdmin();
    }
  }
}
```

**⚠️ SECURITY NOTE:** This allows anyone to read locations and tasks. For production, you should:
- Add authentication to the mobile app
- Or use a more restrictive rule (e.g., `allow read: if request.auth != null;`)

---

### Option 2: Add Authentication to Mobile App (Production-Ready)

Add Firebase Authentication to the mobile app so users can sign in before accessing locations.

**This is the proper solution for production**, but requires:
1. Adding Firebase Auth SDK
2. Creating a login screen
3. Storing auth tokens
4. Updating API calls to include auth headers

---

## 🧪 TESTING AFTER FIX

1. **Update Firestore Rules** (use Option 1 above)
2. **Click "Publish"** in Firebase Console
3. **Restart Expo:**
   ```bash
   cd mobile-app
   npx expo start --clear
   ```
4. **Reload app** on your phone
5. **Check logs** - you should now see:
   ```
   📍 Snapshot size: 7
   📍 Processing document: bd577ffe-d733...
   📍 Total locations processed: 7
   ```

---

## 📊 EXPECTED LOGS (After Fix)

**Good logs:**
```
📍 === FETCH LOCATIONS DEBUG ===
📍 Firestore instance: EXISTS
📍 Collection reference created: locations
📍 Executing getDocs...
📍 Query completed. Snapshot received.
📍 Snapshot size: 7  ← Should be 7, not 0!
📍 Snapshot empty: false
📍 Processing document: bd577ffe-d733-4002-abb8-9ea047c0f326
📍 Document name: Test House
📍 Total locations processed: 7
```

**If still 0:**
- Check that rules were published
- Check that collection name is exactly "locations" (lowercase)
- Check REST API fallback logs

