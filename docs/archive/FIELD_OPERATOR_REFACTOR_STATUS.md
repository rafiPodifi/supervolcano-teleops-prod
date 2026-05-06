# Field Operator Refactoring Status

## ✅ Completed

### Core Type System
- ✅ Updated `UserRole` type to remove `field_operator`
- ✅ Added explicit roles: `oem_teleoperator` and `property_cleaner`
- ✅ Created role helpers: `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `ROLE_GROUPS`
- ✅ Updated organization type mapping for new roles

### UI Components
- ✅ Created `RoleDropdown` component with grouped roles
- ✅ Simplified `OrganizationDropdown` (removed field operator selector)
- ✅ Updated `UserEditDrawer` to use `RoleDropdown`
- ✅ Updated `CreateUserModal` to use `RoleDropdown`
- ✅ Updated `AssignCleanerModal` to fetch both new roles

### Validation
- ✅ Updated `UserValidator` to use new roles
- ✅ Added organization type validation matching

### Migration
- ✅ Created migration script: `/api/admin/migrate/split-field-operator-role`

## ⚠️ Still Needs Update

### Components with `field_operator` references:
1. `src/components/admin/users/UserRow.tsx` - Role badge colors
2. `src/components/admin/users/QuickFilters.tsx` - Quick filter option
3. `src/components/admin/users/CreateUserModal.tsx` - ✅ UPDATED (teleoperatorId conditional)
4. `src/app/api/admin/fix-test-cleaner/route.ts` - Test cleaner fix endpoint
5. `src/app/api/admin/users/create/route.ts` - User creation validation

### Type Definitions:
1. `src/types/user.types.ts` - Has old UserRole type (separate from domain)
2. `src/types/database.ts` - Has UserRole type
3. `src/types/assignment.types.ts` - AssignmentRole type
4. `src/lib/utils/normalizeUser.ts` - User normalization logic

### Permission System:
1. `src/lib/auth/permissions.ts` - Permission checks using `field_operator`
   - `VIEW_LOCATIONS` permission
   - `RECORD_VIDEOS` permission
   - `COMPLETE_TASKS` permission

### API Routes:
1. `src/app/api/admin/locations/[id]/assignments/route.ts` - Assignment validation

## 📋 Next Steps

### Step 1: Run Migration
After deployment, visit:
```
https://YOUR_DEPLOYMENT_URL/api/admin/migrate/split-field-operator-role
```

This will:
- Find all users with `field_operator` role
- Update to `oem_teleoperator` or `property_cleaner` based on organizationId prefix
- Update both Firestore and Auth custom claims

### Step 2: Update Remaining References

Run a search/replace for `field_operator` references and update to:
- `oem_teleoperator` for OEM-related workers
- `property_cleaner` for property-related workers

### Step 3: Update Permission System

Update `src/lib/auth/permissions.ts`:
```typescript
// Replace:
VIEW_LOCATIONS: ['admin', 'partner_manager', 'property_owner', 'field_operator']
// With:
VIEW_LOCATIONS: ['admin', 'partner_manager', 'location_owner', 'oem_teleoperator', 'property_cleaner']

// Replace:
RECORD_VIDEOS: ['field_operator']
COMPLETE_TASKS: ['field_operator']
// With:
RECORD_VIDEOS: ['oem_teleoperator', 'property_cleaner']
COMPLETE_TASKS: ['oem_teleoperator', 'property_cleaner']
```

### Step 4: Update Type Definitions

Consolidate UserRole types to use the domain definition only.

## 🎯 Migration Strategy

The migration script will:
1. Find all `field_operator` users
2. Check their `organizationId` prefix:
   - `oem:` → `oem_teleoperator`
   - `owner:` → `property_cleaner`
   - Other → `property_cleaner` (default)
3. Update both Firestore and Auth

## ✅ Success Criteria

- [ ] No TypeScript errors
- [ ] All `field_operator` references updated
- [ ] Migration script runs successfully
- [ ] UI components work with new roles
- [ ] Permission checks work correctly
- [ ] Assignment modal shows correct users

