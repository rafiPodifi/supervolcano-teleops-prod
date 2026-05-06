# Test Accounts for Team Demo

## Admin Account (You)

```
Email: admin@demo.com
Password: [your password]
Role: superadmin
Access: Full admin portal
```

## Cleaner Accounts (Your Team)

### Team Member 1

```
Email: cleaner1@test.com
Password: TestPass123!
Role: teleoperator
Assigned Location: [Team Member 1's Home]
```

### Team Member 2

```
Email: cleaner2@test.com
Password: TestPass123!
Role: teleoperator
Assigned Location: [Team Member 2's Home]
```

### Team Member 3

```
Email: cleaner3@test.com
Password: TestPass123!
Role: teleoperator
Assigned Location: [Team Member 3's Home]
```

## Setup Steps

1. Create test accounts in Firebase Auth
2. Set custom claims for each (role: 'teleoperator')
3. Create a location for each team member
4. Assign each cleaner to their location
5. Share credentials with team
6. They test in their own homes

## Creating Test Accounts (Firebase Console)

1. Go to Firebase Console → Authentication
2. Click "Add User"
3. Enter email and password
4. Click "Add User"
5. In terminal, set custom claims:

```bash
# For each cleaner account:
firebase auth:set-custom-claims cleaner1@test.com '{"role":"teleoperator","organizationId":"test-org"}'
```

Or use the admin API endpoint if you have one built.

## Setting Custom Claims via API

You can also set custom claims programmatically using Firebase Admin SDK:

```typescript
// In an admin API endpoint
await adminAuth.setCustomUserClaims(userId, {
  role: 'teleoperator',
  organizationId: 'test-org',
});
```

## Verification

After setup, verify:

1. **Firebase Auth**: Users exist with correct emails
2. **Custom Claims**: Each user has `role: 'teleoperator'`
3. **Locations**: Each team member has a location created
4. **Assignments**: SQL table `location_assignments` has entries
5. **Mobile App**: Each cleaner sees only their assigned location

## SQL Verification Query

```sql
-- Check all assignments
SELECT 
  user_email,
  location_name,
  assigned_at
FROM location_assignments
WHERE is_active = true
ORDER BY location_name;
```



