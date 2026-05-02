# Mobile Owner Flow - Implementation Summary

## ✅ Completed

1. **Navigation Structure**
   - `src/navigation/AppNavigator.tsx` - Role-based routing
   - `src/navigation/OwnerNavigator.tsx` - Owner navigation with bottom tabs
   - `src/navigation/CleanerNavigator.tsx` - Cleaner navigation

2. **Templates**
   - `src/lib/templates/location-templates.ts` - Location templates copied from web app

3. **Auth Context**
   - Updated to expose `userProfile` for role detection

## 📝 Next Steps

### 1. Create Owner Screens (6 files needed)

The owner screens need to be created in `src/screens/owner/`:

1. **OwnerHomeScreen.tsx** - List of owner's locations
2. **AddLocationScreen.tsx** - Add location with Google Places autocomplete
3. **LocationWizardScreen.tsx** - Mobile location setup wizard
4. **LocationDetailScreen.tsx** - Location details and management
5. **InviteCleanerScreen.tsx** - Invite cleaner via shareable link
6. **OwnerSettingsScreen.tsx** - Owner settings and profile

### 2. Install Dependencies

```bash
cd mobile-app
pnpm add react-native-google-places-autocomplete
pnpm exec expo install expo-clipboard
pnpm add @react-navigation/bottom-tabs
```

### 3. Update App.tsx

Update `mobile-app/App.tsx` to use the new `AppNavigator`:

```typescript
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationContainer } from '@react-navigation/native';

// Replace existing navigation logic with:
<NavigationContainer>
  <AppNavigator />
</NavigationContainer>
```

### 4. Environment Variables

Add to `mobile-app/app.json` or `.env`:

```json
{
  "expo": {
    "extra": {
      "googlePlacesApiKey": "YOUR_KEY_HERE",
      "apiUrl": "https://your-api.vercel.app",
      "appUrl": "https://supervolcano.app"
    }
  }
}
```

Or use `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`

### 5. Create Test Owner Account

In Firebase Console:

1. **Authentication** → Add User:
   - Email: `owner@test.com`
   - Password: `Test123!`

2. **Firestore** → `users` collection → Add Document:
   - Document ID: (copy UID from step 1)
   - Fields:
     ```json
     {
       "email": "owner@test.com",
       "displayName": "Test Owner",
       "role": "location_owner",
       "organizationId": "owner:test-owner",
       "created_at": (timestamp),
       "updated_at": (timestamp)
     }
     ```

## 🎯 Files Created So Far

- ✅ `src/navigation/AppNavigator.tsx`
- ✅ `src/navigation/OwnerNavigator.tsx`
- ✅ `src/navigation/CleanerNavigator.tsx`
- ✅ `src/lib/templates/location-templates.ts`
- ✅ `src/contexts/AuthContext.tsx` (updated)

## 📋 Remaining Work

- [ ] Create 6 owner screen files
- [ ] Install dependencies
- [ ] Update App.tsx
- [ ] Add environment variables
- [ ] Test with owner@test.com account
- [ ] Create test owner in Firebase

## 🔧 Notes

- Owner screens use `assignedOrganizationId = 'owner:${userId}'` for queries
- Icons use `@expo/vector-icons` (Ionicons) for consistency with existing code
- Structure API calls need `EXPO_PUBLIC_API_URL` environment variable
- Google Places requires `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
