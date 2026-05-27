/**
 * SUPERVOLCANO MOBILE APP
 * Dual-persona app: Owner and Cleaner flows
 * Routes based on user role
 * Last updated: 2025-12-02
 */

import React, { ErrorInfo, Component, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider } from "./src/contexts/AuthContext";
import { PRODUCTION_FATAL_ERROR_COPY } from "./src/utils/user-facing-error";
import AppNavigator from "./src/navigation/AppNavigator";
import { UploadQueueService } from "./src/services/upload-queue.service";
import { ExternalRecordingListener } from "./src/services/external-recording-listener.service";
import { ExternalCamera } from "./src/native/external-camera";

const BATTERY_OPT_PROMPT_KEY = "@battery_opt_prompted_at";
const BATTERY_OPT_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Prompt the user once (per 7-day window) to add the app to Android's
 * unrestricted battery list. Without this, Doze + App Standby can pause
 * upload retries while the screen is off — the most common cause of
 * "upload failed because the phone went to sleep" reports.
 */
async function maybePromptUnrestrictedBattery(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const ignored = await ExternalCamera.isBatteryOptimizationIgnored();
    if (ignored) return;

    const last = await AsyncStorage.getItem(BATTERY_OPT_PROMPT_KEY);
    if (last) {
      const lastMs = parseInt(last, 10);
      if (
        Number.isFinite(lastMs) &&
        Date.now() - lastMs < BATTERY_OPT_PROMPT_COOLDOWN_MS
      ) {
        return;
      }
    }

    Alert.alert(
      "Keep uploads running",
      "Add SuperVolcano to your unrestricted battery list so recordings keep uploading even when the screen is off.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => {
            void AsyncStorage.setItem(
              BATTERY_OPT_PROMPT_KEY,
              String(Date.now()),
            );
          },
        },
        {
          text: "Open settings",
          onPress: () => {
            void ExternalCamera.requestIgnoreBatteryOptimizations();
            void AsyncStorage.setItem(
              BATTERY_OPT_PROMPT_KEY,
              String(Date.now()),
            );
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
