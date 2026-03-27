/**
 * FIREBASE CONFIGURATION
 * Uses EXPO_PUBLIC_ prefixed env vars for Expo compatibility
 * Fallback to app.json extra fields for production builds
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
import { getFirestore, enableNetwork, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

console.log('[Firebase] Initializing Firebase...');

// Get config from app.json extra field (production) or .env (development)
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('[Firebase] Project ID:', firebaseConfig.projectId);
console.log('[Firebase] Storage Bucket:', firebaseConfig.storageBucket);

// Validate config
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  const errorMsg = `[Firebase] Missing config keys: ${missingKeys.join(', ')}`;
  console.error(errorMsg);
  console.error('[Firebase] Available env vars:', Object.keys(process.env).filter(k => k.startsWith('EXPO')));
  console.error('[Firebase] Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
  
  // Don't throw in production - log error but try to continue
  // This allows error boundary to catch and display user-friendly message
  console.error('[Firebase] Config validation failed - app may not work correctly');
}

// Initialize Firebase App
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

console.log('[Firebase] ✅ Firebase app initialized');

// Initialize Auth with AsyncStorage persistence
let auth: Auth;
try {
  // Dynamically import getReactNativePersistence (may not be in TypeScript types but exists at runtime)
  const { getReactNativePersistence } = require('firebase/auth') as { getReactNativePersistence: (storage: any) => any };
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('[Firebase] ✅ Auth initialized with AsyncStorage persistence');
} catch (error: any) {
  // If already initialized, get existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
    console.log('[Firebase] ✅ Using existing Auth instance');
  } else {
    // Fallback to default getAuth (still persists on React Native)
    console.warn('[Firebase] ⚠️ Could not use AsyncStorage persistence, using default getAuth:', error.message);
    auth = getAuth(app);
    console.log('[Firebase] ✅ Auth initialized with default persistence');
  }
}

// Initialize Firestore
const databaseId = Constants.expoConfig?.extra?.firebaseDatabaseId || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || 'default';
let firestore: Firestore;
try {
  firestore = getFirestore(app, databaseId);
  console.log('[Firebase] ✅ Firestore initialized');
  console.log('[Firebase] Database ID:', databaseId);
  
  // Enable network explicitly
  enableNetwork(firestore)
    .then(() => {
      console.log('[Firebase] ✅ Firestore network enabled');
    })
    .catch((error) => {
      console.error('[Firebase] ❌ Failed to enable network:', error);
      // Don't throw - network will auto-enable when available
    });
} catch (error: any) {
  console.error('[Firebase] ❌ Failed to initialize Firestore:', error);
  throw error;
}

// Initialize Storage
let storage: FirebaseStorage;
try {
  storage = getStorage(app);
  console.log('[Firebase] ✅ Firebase Storage initialized');
  console.log('[Firebase] Storage bucket:', firebaseConfig.storageBucket);
} catch (error: any) {
  console.error('[Firebase] ❌ Failed to initialize Storage:', error);
  throw error;
}

export const db = firestore; // Alias for convenience

export { app, auth, firestore, storage };

console.log('[Firebase] ✅ Firebase fully initialized');
console.log('[Firebase] ═══════════════════════════════════════');
