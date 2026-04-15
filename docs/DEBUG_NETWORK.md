# Debugging Network Issues with Firestore

## The Problem
`setDoc` is timing out after 10 seconds. The logs show the request is initiated but never completes.

## Critical Next Step: Check Network Tab

**This is the most important diagnostic step:**

1. **Open DevTools → Network tab**
2. **Clear the network log** (right-click → "Clear")
3. **Filter by "firestore" or "googleapis"**
4. **Try saving a location**
5. **Look for ANY requests to `firestore.googleapis.com`**

### What to Look For:

#### Scenario 1: No Request Appears
- **Meaning:** The SDK isn't sending the request at all
- **Possible Causes:**
  - Firestore SDK is in offline mode
  - Network connection issue
  - SDK configuration problem
  - Browser blocking the request (CORS, extension, etc.)

#### Scenario 2: Request Appears but Status is "Pending"
- **Meaning:** Request was sent but no response received
- **Possible Causes:**
  - Firestore server is slow/overloaded
  - Network timeout
  - Firestore rules are blocking (but should return 403, not hang)

#### Scenario 3: Request Shows 403 Forbidden
- **Meaning:** Permission denied
- **Fix:** Check Firestore rules and admin role

#### Scenario 4: Request Shows 401 Unauthorized
- **Meaning:** Auth token invalid
- **Fix:** Sign out and sign back in

#### Scenario 5: Request Shows 200 OK
- **Meaning:** Success! (But why is setDoc timing out then?)
- **Possible Causes:**
  - SDK promise not resolving
  - Race condition
  - Multiple requests conflicting

## Firestore Connection Type

**Important:** Firestore uses persistent connections (WebSocket or gRPC-Web), not simple HTTP requests. This means:

- The request might not show up as a single HTTP request in Network tab
- It might show as a WebSocket connection
- It might show as multiple gRPC-Web requests
- The connection might be established earlier and reused

## Alternative: Test with REST API

If the SDK isn't working, we can test with direct REST API calls:

```javascript
// In browser console after login:
const user = firebase.auth().currentUser;
const token = await user.getIdToken();

const testDoc = {
  name: "Test Location",
  partnerOrgId: "demo-org",
  createdBy: user.uid,
  createdAt: new Date().toISOString(),
  isActive: true,
  taskCount: 0,
};

const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/super-volcano-oem-portal/databases/(default)/documents/locations/test-${Date.now()}`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        name: { stringValue: testDoc.name },
        partnerOrgId: { stringValue: testDoc.partnerOrgId },
        createdBy: { stringValue: testDoc.createdBy },
        isActive: { booleanValue: testDoc.isActive },
        taskCount: { integerValue: testDoc.taskCount },
      }
    })
  }
);

console.log('REST API Response:', await response.json());
```

If this works but `setDoc` doesn't, it's an SDK issue.

## Check Firestore Rules

1. Go to Firebase Console → Firestore Database → Rules
2. Verify the rules are:
   ```
   match /locations/{locationId} {
     allow read: if partnerMatches(resource.data.partnerOrgId);
     allow create, update, delete: if isAdmin();
   }
   ```
3. Click "Publish" if there's a publish button
4. Make sure rules are actually deployed (not just saved)

## Check Browser Console for CORS Errors

Look for any CORS-related errors in the console. These would indicate the request is being blocked by the browser.

## Check Browser Extensions

Some browser extensions (ad blockers, privacy tools) can block Firestore requests. Try:
1. Disable all extensions
2. Try in incognito mode
3. Try a different browser

## Next Steps

1. **Check Network tab** (most important)
2. **Share screenshot of Network tab** showing requests (or lack thereof)
3. **Try the REST API test** above
4. **Check Firestore rules** are deployed
5. **Check for CORS errors** in console

