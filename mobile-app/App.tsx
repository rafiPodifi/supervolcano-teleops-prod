/**
 * SUPERVOLCANO MOBILE APP
 * Dual-persona app: Owner and Cleaner flows
 * Routes based on user role
 * Last updated: 2025-12-02
 */

import React, { ErrorInfo, Component, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import { AuthProvider } from "./src/contexts/AuthContext";
import { PRODUCTION_FATAL_ERROR_COPY } from "./src/utils/user-facing-error";
import AppNavigator from "./src/navigation/AppNavigator";
import { UploadQueueService } from "./src/services/upload-queue.service";
import { ExternalRecordingListener } from "./src/services/external-recording-listener.service";
import { ExternalCamera } from "./src/native/external-camera";

/**
 * Prompt the user every cold launch (Android only) when the app isn't
 * already exempt from battery optimizations. Doze + App Standby pause
 * background upload retries while the screen is off — exempting the app
 * keeps recordings uploading. Once the user grants the exemption, this
 * silently no-ops on future launches.
 */
async function maybePromptUnrestrictedBattery(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const ignored = await ExternalCamera.isBatteryOptimizationIgnored();
    if (ignored) return;

    Alert.alert(
      "Keep uploads running",
      "Add SuperVolcano to your unrestricted battery list so recordings keep uploading even when the screen is off.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Open settings",
          onPress: () => {
            void ExternalCamera.requestIgnoreBatteryOptimizations();
          },
        },
      ],
    );
  } catch (error) {
    console.warn("[App] battery optimization prompt failed", error);
  }
}

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
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
    console.error("[ErrorBoundary] Stack:", error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>
            {PRODUCTION_FATAL_ERROR_COPY.title}
          </Text>
          <Text style={styles.errorHint}>
            {PRODUCTION_FATAL_ERROR_COPY.message}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  console.log("[App] Initializing...");

  useEffect(() => {
    void UploadQueueService.initialize();
    ExternalRecordingListener.register();
    // Prompt for unrestricted battery on launch (Android only, once per
    // 7-day window). Fires after a short delay so the splash / first frame
    // is up before the system Alert appears.
    const promptTimer = setTimeout(() => {
      void maybePromptUnrestrictedBattery();
    }, 1500);
    return () => {
      clearTimeout(promptTimer);
      ExternalRecordingListener.unregister();
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#dc2626",
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: "#991b1b",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
