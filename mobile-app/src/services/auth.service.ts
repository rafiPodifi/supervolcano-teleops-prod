/**
 * AUTHENTICATION SERVICE - Mobile App
 * Handles Firebase Auth + Firestore user profile fetching
 * Validates role and organization assignment
 */

import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import type { UserProfile } from '@/types/user.types';
import { getFriendlyErrorCopy } from '@/utils/user-facing-error';

const USER_PROFILE_KEY = '@user_profile';

export class AuthService {
  /**
   * Sign in with email and password
   * Validates role is allowed for mobile app (location_cleaner, oem_teleoperator, or location_owner)
   */
  static async signIn(email: string, password: string): Promise<UserProfile> {
    try {
      console.log('[AuthService] Starting sign in for:', email);
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log('[AuthService] Firebase auth successful, uid:', firebaseUser.uid);

      // Fetch user profile from Firestore
      console.log('[AuthService] Fetching user profile from Firestore...');
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        console.error('[AuthService] User profile not found in Firestore');
        Alert.alert('Error', 'User profile not found. Please contact support.');
        throw new Error('User profile not found. Please contact support.');
      }

      const userData = userDoc.data();
      console.log('[AuthService] User data:', JSON.stringify(userData));
      
      // Validate role - must be an allowed mobile app role
      const allowedRoles = ['location_cleaner', 'oem_teleoperator', 'location_owner', 'member'];
      if (!allowedRoles.includes(userData.role)) {
        console.error('[AuthService] Invalid role:', userData.role);
        await firebaseSignOut(auth);
        Alert.alert('Access Denied', 'Your role does not have access to the mobile app.');
        throw new Error('Your role does not have access to the mobile app. Please use the web portal.');
      }

      // Validate has organization (skip for members - they're individual users)
      if (userData.role !== 'member' && !userData.organizationId) {
        console.error('[AuthService] No organizationId');
        await firebaseSignOut(auth);
        Alert.alert('Error', 'Your account is not assigned to an organization.');
        throw new Error('Your account is not assigned to an organization. Please contact your manager.');
      }

      const userProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: userData.displayName || firebaseUser.displayName || firebaseUser.email!,
        role: userData.role,
        organizationId: userData.organizationId,
        created_at: userData.created_at?.toDate() || new Date(),
        updated_at: userData.updated_at?.toDate() || new Date(),
      };

      console.log('[AuthService] Created user profile:', JSON.stringify(userProfile));

      // Store profile locally for offline access
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
      console.log('[AuthService] Profile cached to AsyncStorage');

      return userProfile;
    } catch (error: any) {
      console.error('[AuthService] Sign in error:', error.code, error.message);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        Alert.alert('Error', 'No account found with this email.');
        throw new Error('No account found with this email.');
      }
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Incorrect password.');
        throw new Error('Incorrect password.');
      }
      if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'Invalid email format.');
        throw new Error('Invalid email format.');
      }
      if (error.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Too many failed attempts. Please try again later.');
        throw new Error('Too many failed attempts. Please try again later.');
      }
      if (error.code === 'auth/invalid-credential') {
        Alert.alert('Error', 'Invalid email or password.');
        throw new Error('Invalid email or password.');
      }
      
      // Show generic alert for unknown errors
      if (!error.message?.includes('does not have access')) {
        const friendly = getFriendlyErrorCopy(error, 'login');
        Alert.alert(friendly.title, friendly.message);
      }
      
      throw error;
    }
  }

  /**
   * Sign out and clear local data
   */
  static async signOut(): Promise<void> {
    await firebaseSignOut(auth);
    await AsyncStorage.removeItem(USER_PROFILE_KEY);
  }

  /**
   * Get cached user profile (for offline access)
   */
  static async getCachedProfile(): Promise<UserProfile | null> {
    try {
      const cached = await AsyncStorage.getItem(USER_PROFILE_KEY);
      console.log('[AuthService] Cached profile:', cached ? 'found' : 'not found');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[AuthService] Error reading cached profile:', error);
      return null;
    }
  }

  /**
   * Listen for auth state changes
   */
  static onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Refresh user profile from Firestore
   */
  static async refreshProfile(uid: string): Promise<UserProfile> {
    console.log('[AuthService] Refreshing profile for uid:', uid);
    
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        console.error('[AuthService] User profile not found during refresh');
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();
      const user = auth.currentUser;

      const userProfile: UserProfile = {
        uid,
        email: user?.email || userData.email,
        displayName: userData.displayName || user?.displayName || user?.email!,
        role: userData.role,
        organizationId: userData.organizationId,
        created_at: userData.created_at?.toDate() || new Date(),
        updated_at: userData.updated_at?.toDate() || new Date(),
      };

      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
      console.log('[AuthService] Profile refreshed and cached');
      
      return userProfile;
    } catch (error: any) {
      console.error('[AuthService] Refresh profile error:', error);
      throw error;
    }
  }
}
