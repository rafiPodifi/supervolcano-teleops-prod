/**
 * MEMBER RECORD SCREEN
 * Used by MemberNavigator (oem_teleoperator role).
 * External USB UVC camera only — native phone camera removed.
 * Audio capture disabled.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useCameraPermission } from "react-native-vision-camera";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MemberStackParamList } from "../../navigation/MemberNavigator";
import { useAuth } from "../../contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { MilestoneCelebration } from "../../components/MilestoneCelebration";
import { useMilestones } from "../../hooks/useMilestones";
import ExternalCameraPanel from "../../components/external-camera/ExternalCameraPanel";
import { getExternalCameraDisplayState } from "../../components/external-camera/external-camera-display";
import ExternalCameraView from "../../components/external-camera/ExternalCameraView";
import { useExternalCameraDiagnostics } from "../../hooks/useExternalCameraDiagnostics";
import { useRecordingConfig } from "../../hooks/useRecordingConfig";
import {
  ExternalCamera,
  capQualityToProfile,
} from "../../native/external-camera";
import { getFriendlyErrorCopy } from "../../utils/user-facing-error";
import * as FileSystem from "expo-file-system/legacy";
import { UploadQueueService } from "../../services/upload-queue.service";
import { ExternalRecordingListener } from "../../services/external-recording-listener.service";

type NavigationProp = NativeStackNavigationProp<MemberStackParamList>;

const HOURS_FOR_REWARD = 10;

function mapExternalRecordingError(message?: string): {
  title: string;
  message: string;
} {
  switch (message) {
    case "encoder":
    case "muxer":
      return {
        title: "Recording failed",
        message: "Recording could not be saved. Please try again.",
      };
    case "file_io":
      return {
        title: "Recording failed",
        message:
          "Couldn't write the recording to storage. Free some space and try again.",
      };
    case "recording_in_progress":
      return {
        title: "Recording failed",
        message:
          "A previous recording is still finalizing. Please wait and try again.",
      };
    case "invalid_camera":
      return {
        title: "Recording failed",
        message: "Camera is no longer available. Reconnect and try again.",
      };
    case "recording_too_short":
      return {
        title: "Recording too short",
        message: "Hold record for a moment longer next time.",
      };
    case "camera_no_frames":
      return {
        title: "Recording failed",
        message:
          "Camera connected but didn't send any video frames. Try unplugging and reconnecting.",
      };
    case "video_format_never_locked":
      return {
        title: "Recording failed",
        message:
          "Camera couldn't negotiate a video format. Try a different USB cable or camera.",
      };
    case "muxer_failed_to_start":
    case "recording_produced_no_output":
      return {
        title: "Recording failed",
        message:
          "Recording could not be saved. Please try again — if the problem continues, reconnect the camera.",
      };
    default:
      return {
        title: "Recording failed",
        message: message ?? "Recording stopped unexpectedly. Please try again.",
      };
  }
}

// Gentle encouragement that rotates
const ENCOURAGEMENTS = [
  "You're doing great.",
  "This counts. All of it.",
  "Every minute matters.",
  "Still here? Amazing.",
  "Progress is progress.",
  "You showed up. That's huge.",
];

export default function MemberRecordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const externalCamera = useExternalCameraDiagnostics();
  const recordingConfig = useRecordingConfig();
  const isExternalReady = externalCamera.isReady;
  const isExternalReadyRef = useRef(isExternalReady);

  // Permissions
  const {
    hasPermission: hasCameraPermission,
    requestPermission: requestCameraPermission,
  } = useCameraPermission();
  const cameraPermissionStatus =
    hasCameraPermission === null
      ? "unknown"
      : hasCameraPermission
        ? "granted"
        : "denied";

  console.log("[MemberRecord] Mounted - camPerm:", hasCameraPermission);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentEncouragement, setCurrentEncouragement] = useState(
    ENCOURAGEMENTS[0],
  );

  // Milestone system
  const {
    checkMilestone,
    currentMilestone,
    dismissMilestone,
    resetMilestones,
  } = useMilestones();
  const [totalHoursUploaded] = useState(4.2); // TODO: Get from Firestore

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const encouragementRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(isRecording);
  const segmentNumberRef = useRef(0);
  const recordingStartedAtRef = useRef<string | null>(null);

  useEffect(() => {
    isExternalReadyRef.current = isExternalReady;
  }, [isExternalReady]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!ExternalCamera.isSupported) {
      return;
    }

    ExternalCamera.setExternalModeEnabled(true).catch((error) => {
      console.warn(
        "[ExternalCamera] Failed to enable external mode on mount",
        error,
      );
    });

    return () => {
      ExternalCamera.setExternalModeEnabled(false).catch((error) => {
        console.warn(
          "[ExternalCamera] Failed to disable external mode on unmount",
          error,
        );
      });
    };
  }, []);

  // Calculate progress
  const totalHours = totalHoursUploaded + elapsedSeconds / 3600;
  const progress = Math.min(totalHours / HOURS_FOR_REWARD, 1);

  // Timer
  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newSeconds = prev + 1;
        checkMilestone(newSeconds);
        return newSeconds;
      });
    }, 1000);

    // Rotate encouragements every 45 seconds
    encouragementRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * ENCOURAGEMENTS.length);
      setCurrentEncouragement(ENCOURAGEMENTS[randomIndex]);
    }, 45000);

    return () => {
      clearInterval(timer);
      if (encouragementRef.current) clearInterval(encouragementRef.current);
    };
  }, [isRecording, checkMilestone]);

  // Pulse animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (!ExternalCamera.isSupported) {
      return;
    }

    const subscription = ExternalCamera.addUsbDetachListener(() => {
      if (isRecordingRef.current) {
        stopRecording();
        Alert.alert(
          "Camera Disconnected",
          "Your camera was unplugged. The session has been saved. Reconnect the camera and start a new session.",
        );
      }
    });

    ExternalRecordingListener.setErrorHandler((message) => {
      if (!isRecordingRef.current) {
        return;
      }
      setIsRecording(false);
      recordingStartedAtRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const friendly = mapExternalRecordingError(message);
      Alert.alert(friendly.title, friendly.message);
    });

    return () => {
      subscription?.remove();
      ExternalRecordingListener.setErrorHandler(null);
    };
  }, []);

  const ensureExternalRecordingDirectory =
    useCallback(async (): Promise<string> => {
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No writable directory available");
      }

      const recordingsDir = `${baseDir}external-recordings/`;
      const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(recordingsDir, {
          intermediates: true,
        });
      }
      return recordingsDir;
    }, []);

  const createExternalRecordingPath = useCallback(async (): Promise<string> => {
    const recordingsDir = await ensureExternalRecordingDirectory();
    const filename = `external-${Date.now()}.mp4`;
    return `${recordingsDir}${filename}`;
  }, [ensureExternalRecordingDirectory]);

  const startRecording = useCallback(async () => {
    try {
      if (!ExternalCamera.isSupported) {
        throw new Error("External camera not supported");
      }

      if (!isExternalReadyRef.current) {
        Alert.alert(
          "Camera Not Ready",
          "External camera is still initialising. Please wait a moment and try again.",
        );
        return;
      }

      resetMilestones();
      setElapsedSeconds(0);
      recordingStartedAtRef.current = new Date().toISOString();

      setIsRecording(true);
      const outputPath = await createExternalRecordingPath();
      const effectiveQuality = externalCamera.selectedProfile
        ? capQualityToProfile(
            recordingConfig.externalCamera.quality,
            externalCamera.selectedProfile,
          )
        : recordingConfig.externalCamera.quality;
      ExternalRecordingListener.beginSegment({
        jobTitle: "Generic recording",
        recordingMode: "generic",
        startedAt: recordingStartedAtRef.current ?? new Date().toISOString(),
      });
      await ExternalCamera.startRecording(outputPath, {
        enableAudio: false,
        quality: effectiveQuality,
      });
    } catch (error) {
      setIsRecording(false);
      recordingStartedAtRef.current = null;
      console.error("[MemberRecord] Start error:", error);
    }
  }, [
    createExternalRecordingPath,
    resetMilestones,
    recordingConfig,
    externalCamera,
  ]);

  const stopRecording = async () => {
    // Wait for the encoder's terminal event before tearing down the recording,
    // otherwise stopRecording can race with the encoder's flush.
    const terminal = ExternalRecordingListener.awaitNextTerminal(5000);
    try {
      await ExternalCamera.stopRecording();
    } catch (error) {
      console.error("[MemberRecord] stopRecording native error:", error);
    }
    try {
      await terminal;
    } catch (error) {
      console.warn("[MemberRecord] terminal wait error:", error);
    }

    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedSeconds(0);
    resetMilestones();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  // Handle record button press
  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (!isExternalReady) {
      Alert.alert("External Camera", externalCamera.statusMessage);
      return;
    }
    startRecording();
  };

  // Handle back/close
  const handleClose = () => {
    if (isRecording) {
      Alert.alert(
        "Stop Recording?",
        "This will end your session. All recorded video will be saved.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Stop & Exit",
            style: "destructive",
            onPress: () => {
              stopRecording(); // Don't navigate to complete, just go back
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  const externalDisplay = getExternalCameraDisplayState({
    supportState: externalCamera.supportState,
    connectionPhase: externalCamera.connectionPhase,
    sessionState: externalCamera.sessionState,
    statusMessage: externalCamera.statusMessage,
    hasLivePreview: externalCamera.hasLivePreview,
    recordingActive: isRecording,
    isModeTransitioning: false,
  });

  // Get status message
  const getStatusMessage = (): string => {
    if (externalCamera.isConnectionTimedOut) {
      return "Camera couldn't connect. Try unplugging and reconnecting.";
    }
    return externalDisplay.footerMessage;
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Header pill component
  const HeaderPill = ({ children }: { children: React.ReactNode }) => {
    if (Platform.OS === "ios") {
      return (
        <BlurView intensity={60} tint="dark" style={styles.headerPill}>
          {children}
        </BlurView>
      );
    }
    return (
      <View style={[styles.headerPill, styles.headerPillAndroid]}>
        {children}
      </View>
    );
  };

  // Permission screen
  if (!hasCameraPermission) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="videocam-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          We need camera access to record your session.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestCameraPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Full-screen external camera preview */}
      <View style={StyleSheet.absoluteFill}>
        <ExternalCameraPanel
          cameraPermissionStatus={cameraPermissionStatus}
          usbDeviceDetected={externalCamera.attachedUsbVideoDeviceCount > 0}
          connectionTestStatus={externalDisplay.connectionTestStatus}
          connectionLabel={externalDisplay.connectionLabel}
          connectionHelperText={externalDisplay.connectionHelperText}
          showRetryAction={externalDisplay.showRetryAction}
          simulationControls={externalCamera.simulationControls}
          onOpenSettings={externalCamera.openSettings}
          onRetry={externalCamera.retryPreview}
          preview={
            !externalCamera.isSimulated ? (
              <ExternalCameraView style={StyleSheet.absoluteFill} />
            ) : undefined
          }
          showPreviewPlaceholder={externalDisplay.showPreviewPlaceholder}
          style={{
            paddingTop: insets.top + 120,
            paddingBottom: insets.bottom + 160,
          }}
        />
      </View>

      {/* Top header with progress */}
      <View style={[styles.topContainer, { top: insets.top + 10 }]}>
        <HeaderPill>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Mini progress bar */}
          <View style={styles.miniProgressContainer}>
            <View style={styles.miniProgressTrack}>
              <Animated.View
                style={[
                  styles.miniProgressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.miniProgressText}>
              {totalHours.toFixed(1)}/{HOURS_FOR_REWARD}h
            </Text>
          </View>
          {/* Recording indicator */}
          {isRecording && (
            <Animated.View
              style={[
                styles.recordingIndicator,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={styles.recordingDot} />
            </Animated.View>
          )}
        </HeaderPill>
      </View>

      {/* Milestone celebration overlay */}
      {currentMilestone && (
        <MilestoneCelebration
          milestone={currentMilestone}
          totalHours={totalHoursUploaded + elapsedSeconds / 3600}
          goalHours={10}
          onDismiss={dismissMilestone}
          onTakeBreak={
            currentMilestone >= 7200
              ? () => {
                  dismissMilestone();
                  stopRecording();
                }
              : undefined
          }
        />
      )}

      {/* Bottom controls */}
      <View style={[styles.bottomContainer, { bottom: insets.bottom + 30 }]}>
        {/* Timer - only show when recording */}
        {isRecording && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        )}

        {/* Record/Stop button */}
        <TouchableOpacity
          onPress={handleRecordPress}
          style={[
            styles.recordButtonOuter,
            !isExternalReady ? styles.recordButtonDisabled : null,
          ]}
          activeOpacity={0.8}
          testID="record-button"
        >
          <View
            style={[
              styles.recordButtonInner,
              isRecording && styles.recordButtonActive,
            ]}
          >
            {isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={styles.recordIcon} />
            )}
          </View>
        </TouchableOpacity>

        {/* Status text */}
        <View style={styles.statusContainer}>
          {externalDisplay.showSpinner && (
            <ActivityIndicator
              size="small"
              color="rgba(255,255,255,0.8)"
              style={styles.uploadingSpinner}
            />
          )}
          <Text style={styles.statusText} testID="recording-status-text">
            {getStatusMessage()}
          </Text>
        </View>

        {/* Camera connection timeout retry */}
        {externalCamera.isConnectionTimedOut && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={async () => {
              externalCamera.resetConnectionTimeout();
              await externalCamera.retryPreview();
            }}
          >
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        )}

        {/* Encouragement */}
        {isRecording && (
          <Text style={styles.encouragement}>{currentEncouragement}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 40,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  backLink: {
    marginTop: 24,
    padding: 10,
  },
  backLinkText: {
    fontSize: 16,
    color: "#888",
  },

  // Top header
  topContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    overflow: "hidden",
  },
  headerPillAndroid: {
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  miniProgressContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    marginRight: 6,
    gap: 6,
  },
  miniProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  miniProgressFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
  miniProgressText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  recordingIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,59,48,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff3b30",
  },

  // Bottom controls
  bottomContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  timerContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  timerText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
    fontVariant: ["tabular-nums"],
    ...Platform.select({
      ios: {
        fontFamily: "Helvetica Neue",
      },
      android: {
        fontFamily: "sans-serif-medium",
      },
    }),
  },
  recordButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  recordButtonDisabled: {
    opacity: 0.45,
  },
  recordButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  recordIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ff3b30",
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#ff3b30",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  uploadingSpinner: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      },
    }),
  },
  encouragement: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
