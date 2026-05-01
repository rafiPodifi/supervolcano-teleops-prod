# Owner Flow Implementation Guide

## Status: In Progress

This document tracks the implementation of the location owner flow for the mobile app.

## Files Created

### ✅ Core Infrastructure
- `src/lib/templates/location-templates.ts` - Location templates copied from web app
- `src/navigation/AppNavigator.tsx` - Role-based routing
- `src/navigation/OwnerNavigator.tsx` - Owner navigation with bottom tabs
- `src/navigation/CleanerNavigator.tsx` - Cleaner navigation (existing flow)
- `src/contexts/AuthContext.tsx` - Updated to expose userProfile

### 📝 Owner Screens (To Be Created)
- `src/screens/owner/OwnerHomeScreen.tsx` - List of owner's locations
- `src/screens/owner/AddLocationScreen.tsx` - Add location with Google Places
- `src/screens/owner/LocationWizardScreen.tsx` - Mobile location setup wizard
- `src/screens/owner/LocationDetailScreen.tsx` - Location details and management
- `src/screens/owner/InviteCleanerScreen.tsx` - Invite cleaner via link
- `src/screens/owner/OwnerSettingsScreen.tsx` - Owner settings

## Dependencies Needed

```bash
npm install react-native-google-places-autocomplete
npx expo install expo-clipboard
npm install @react-navigation/bottom-tabs
```

## Environment Variables Needed

Add to `app.json` or `.env`:
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` - For address autocomplete
- `EXPO_PUBLIC_API_URL` - Backend API URL for structure API calls
- `EXPO_PUBLIC_APP_URL` - App URL for invite links

## Next Steps

1. Install dependencies
2. Create owner screens (following patterns in existing screens)
3. Update App.tsx to use new navigation structure
4. Test with owner@test.com account
5. Create test owner account in Firebase

