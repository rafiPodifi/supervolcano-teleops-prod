/**
 * SUPERVOLCANO MOBILE APP
 * Dual-persona app: Owner and Cleaner flows
 * Routes based on user role
 * Last updated: 2025-12-02
 */

import React, { ErrorInfo, Component } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, StyleSheet } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { PRODUCTION_FATAL_ERROR_COPY } from './src/utils/user-facing-error';
// TEMPORARILY DISABLED FOR EXPO GO TESTING
// BLE library (react-native-ble-plx) doesn't work in Expo Go - requires native build
// import { GoProProvider } from './src/contexts/GoProContext';
import AppNavigator from './src/navigation/AppNavigator';

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Stack:', error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{PRODUCTION_FATAL_ERROR_COPY.title}</Text>
          <Text style={styles.errorHint}>{PRODUCTION_FATAL_ERROR_COPY.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  console.log('[App] Initializing...');
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        {/* TEMPORARILY DISABLED FOR EXPO GO TESTING */}
        {/* <GoProProvider> */}
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
        {/* </GoProProvider> */}
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
