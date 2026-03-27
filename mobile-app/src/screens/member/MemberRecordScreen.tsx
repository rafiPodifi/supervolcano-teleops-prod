/**
 * MEMBER RECORD SCREEN
 * Full camera experience with gamification overlay
 * Based on CameraScreen.tsx but with progress tracking and celebrations
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  VideoFile,
} from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MemberStackParamList } from '../../navigation/MemberNavigator';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import Mascot from '../../components/member/Mascot';
import { MilestoneCelebration } from '../../components/MilestoneCelebration';
import { useMilestones } from '../../hooks/useMilestones';
import CameraModeToggle, { CameraMode } from '../../components/external-camera/CameraModeToggle';
import ExternalCameraPanel from '../../components/external-camera/ExternalCameraPanel';
import ExternalCameraView from '../../components/external-camera/ExternalCameraView';
import { useExternalCameraDiagnostics } from '../../hooks/useExternalCameraDiagnostics';
import { ExternalCamera } from '../../native/external-camera';
import { normalizeLocalFileUri } from '../../utils/local-file-uri';
import * as FileSystem from 'expo-file-system/legacy';

type NavigationProp = NativeStackNavigationProp<MemberStackParamList>;

const HOURS_FOR_REWARD = 10;
const SEGMENT_DURATION = 300; // 5 minutes

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
  const cameraRef = useRef<Camera>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('native');
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [nativeCameraMountKey, setNativeCameraMountKey] = useState(0);
  const externalCamera = useExternalCameraDiagnostics();
  const isExternalMode = cameraMode === 'external';
  const isExternalReady = isExternalMode && externalCamera.isReady;
  const isNativeCameraActive = cameraMode === 'native';
  const showExternalToggle = externalCamera.isSupported;
  const isExternalModeRef = useRef(isExternalMode);

  // Permissions
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  const cameraPermissionStatus =
    hasCameraPermission === null
      ? 'unknown'
      : hasCameraPermission
      ? 'granted'
      : 'denied';

  // Camera device - prefer ultra-wide for cleaning (captures more)
  const device = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });

  console.log('[MemberRecord] Mounted - camera:', !!device, 'camPerm:', hasCameraPermission, 'micPerm:', hasMicPermission);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentEncouragement, setCurrentEncouragement] = useState(ENCOURAGEMENTS[0]);
  const hasLiveExternalPreview =
    isExternalMode && (externalCamera.hasLivePreview || isRecording);
  
  // Milestone system
  const { checkMilestone, currentMilestone, dismissMilestone, resetMilestones } = useMilestones();
  const [totalHoursUploaded] = useState(4.2); // TODO: Get from Firestore

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const encouragementRef = useRef<NodeJS.Timeout | null>(null);
  const shouldResumeRecordingRef = useRef(false);

  useEffect(() => {
    isExternalModeRef.current = isExternalMode;
  }, [isExternalMode]);

  useEffect(() => {
    if (!ExternalCamera.isSupported) {
      return;
    }

    ExternalCamera.setExternalModeEnabled(false).catch((error) => {
      console.warn('[ExternalCamera] Failed to reset external mode on mount', error);
    });

    return () => {
      ExternalCamera.setExternalModeEnabled(false).catch((error) => {
        console.warn('[ExternalCamera] Failed to disable external mode on unmount', error);
      });
    };
  }, []);

  // Calculate progress
  const totalHours = totalHoursUploaded + (elapsedSeconds / 3600);
  const progress = Math.min(totalHours / HOURS_FOR_REWARD, 1);

  // Start recording on mount
  // COMMENTED OUT: Auto-start disabled to isolate camera render vs recording crash
  // useEffect(() => {
  //   if (hasCameraPermission && hasMicPermission && device) {
  //     startRecording();
  //   }
  //   return () => {
  //     if (timerRef.current) clearInterval(timerRef.current);
  //     if (encouragementRef.current) clearInterval(encouragementRef.current);
  //   };
  // }, [hasCameraPermission, hasMicPermission, device, startRecording]);

  // Timer
  useEffect(() => {
    if (!isRecording) return;
    
    const timer = setInterval(() => {
      setElapsedSeconds(prev => {
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
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
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

    const subscription = ExternalCamera.addRecordingStateListener((event) => {
      if (!isExternalModeRef.current) {
        return;
      }

      if (event.state === 'finalized') {
        setIsRecording(false);
        if (event.filePath) {
          console.log(
            '[MemberRecord] External video saved:',
            normalizeLocalFileUri(event.filePath)
          );
        }
      }

      if (event.state === 'error') {
        console.error('[MemberRecord] External recording error:', event.message);
        setIsRecording(false);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const ensureExternalRecordingDirectory = useCallback(async (): Promise<string> => {
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error('No writable directory available');
    }

    const recordingsDir = `${baseDir}external-recordings/`;
    const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(recordingsDir, { intermediates: true });
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
      resetMilestones();
      setElapsedSeconds(0);
      setIsRecording(true);

      if (isExternalModeRef.current) {
        if (!ExternalCamera.isSupported) {
          throw new Error('External camera not supported');
        }

        const outputPath = await createExternalRecordingPath();
        await ExternalCamera.startRecording(outputPath, {
          enableAudio: false,
          quality: 'hd',
        });
        return;
      }

      if (!cameraRef.current) return;

      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          console.log('[MemberRecord] Video saved:', video.path);
          // TODO: Upload to Firebase Storage, update hoursUploaded
        },
        onRecordingError: (error) => {
          console.error('[MemberRecord] Recording error:', error);
        },
        fileType: 'mp4',
      });
    } catch (error) {
      console.error('[MemberRecord] Start error:', error);
    }
  }, [createExternalRecordingPath, resetMilestones]);

  const stopRecording = async (navigateToComplete: boolean = true) => {
    try {
      if (isExternalModeRef.current) {
        await ExternalCamera.stopRecording();
      } else {
        if (!cameraRef.current || !isRecording) return;
        await cameraRef.current.stopRecording();
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Navigate to completion screen after stopping
      if (navigateToComplete) {
        navigation.replace('SessionComplete', {
          sessionMinutes: Math.floor(elapsedSeconds / 60),
          totalHours: totalHoursUploaded + (elapsedSeconds / 3600),
          goalHours: 10,
        });
      }
    } catch (error) {
      console.error('[MemberRecord] Stop error:', error);
    }
  };

  // Handle record button press
  const handleRecordPress = () => {
    if (isModeTransitioning) {
      return;
    }
    if (isRecording) {
      stopRecording();
      return;
    }
    if (isExternalMode && !isExternalReady) {
      Alert.alert(
        'External Camera',
        externalCamera.statusMessage
      );
      return;
    }
    startRecording();
  };

  // Handle back/close
  const handleClose = () => {
    if (isRecording) {
      Alert.alert(
        'Stop Recording?',
        'This will end your session. All recorded video will be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop & Exit',
            style: 'destructive',
            onPress: () => {
              stopRecording(false); // Don't navigate to complete, just go back
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleCameraModeChange = async (mode: CameraMode) => {
    if (mode === cameraMode || isModeTransitioning) {
      return;
    }

    setIsModeTransitioning(true);
    const wasRecording = isRecording;
    if (wasRecording) {
      await stopRecording(false);
      shouldResumeRecordingRef.current = true;
    }

    try {
      if (mode === 'external') {
        setCameraMode(mode);
        if (ExternalCamera.isSupported) {
          ExternalCamera.setExternalModeEnabled(true)
            .then(() => externalCamera.refresh())
            .catch((error) => {
              console.warn('[ExternalCamera] Mode switch failed', error);
            });
        }
      } else {
        setNativeCameraMountKey((currentKey) => currentKey + 1);
        setCameraMode(mode);
        if (ExternalCamera.isSupported) {
          ExternalCamera.setExternalModeEnabled(false)
            .then(() => externalCamera.refresh())
            .catch((error) => {
              console.warn('[ExternalCamera] Mode switch failed', error);
            });
        }
      }
    } catch (error) {
      console.warn('[ExternalCamera] Mode switch failed', error);
    } finally {
      setIsModeTransitioning(false);
    }
  };

  useEffect(() => {
    if (!shouldResumeRecordingRef.current) {
      return;
    }

    if (isModeTransitioning) {
      return;
    }

    if (cameraMode === 'external' && !isExternalReady) {
      return;
    }

    shouldResumeRecordingRef.current = false;
    startRecording();
  }, [cameraMode, isExternalReady, isModeTransitioning, startRecording]);

  // Get status message
  const getStatusMessage = (): string => {
    if (isModeTransitioning) {
      return 'Switching camera...';
    }

    if (isExternalMode) {
      if (isRecording) {
        return 'Recording from external camera...';
      }

      if (externalCamera.hasLivePreview) {
        return 'External camera preview is live.';
      }

      return externalCamera.statusMessage;
    }

    if (isRecording) {
      return 'Recording...';
    }
    return 'Tap to start recording';
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Permission request
  const requestPermissions = async () => {
    await requestCameraPermission();
    await requestMicPermission();
  };

  // Header pill component
  const HeaderPill = ({ children }: { children: React.ReactNode }) => {
    if (Platform.OS === 'ios') {
      return (
        <BlurView intensity={60} tint="dark" style={styles.headerPill}>
          {children}
        </BlurView>
      );
    }
    return <View style={[styles.headerPill, styles.headerPillAndroid]}>{children}</View>;
  };

  // Permission screen
  if (!hasCameraPermission || !hasMicPermission) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="videocam-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          We need camera access to record your cleaning session.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No device
  if (!device) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="camera-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>No Camera Found</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen camera */}
      {isExternalMode && showExternalToggle ? (
        <View style={StyleSheet.absoluteFill}>
          <ExternalCameraPanel
            cameraPermissionStatus={cameraPermissionStatus}
            connectionStatus={externalCamera.connectionStatus}
            supportState={externalCamera.supportState}
            showRetryAction={
              !hasLiveExternalPreview &&
              (externalCamera.connectionPhase === 'error' ||
                externalCamera.sessionState === 'error')
            }
            sessionState={externalCamera.sessionState}
            statusMessage={externalCamera.statusMessage}
            usbDeviceDetected={externalCamera.attachedUsbVideoDeviceCount > 0}
            hasLivePreview={externalCamera.hasLivePreview}
            recordingActive={isRecording}
            simulationControls={externalCamera.simulationControls}
            onOpenSettings={externalCamera.openSettings}
            onRetry={externalCamera.retryPreview}
            preview={
              !externalCamera.isSimulated ? (
                <ExternalCameraView
                  style={StyleSheet.absoluteFill}
                />
              ) : undefined
            }
            showPreviewPlaceholder={!hasLiveExternalPreview}
            style={{
              paddingTop: insets.top + 120,
              paddingBottom: insets.bottom + 160,
            }}
          />
        </View>
      ) : (
        <Camera
          key={`member-native-camera-${nativeCameraMountKey}`}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isNativeCameraActive}
          video={true}
          audio={true}
          zoom={0.5}
        />
      )}

      {/* Mascot witness - bottom left */}
      {!isExternalMode && (
        <View style={styles.mascotWitness}>
          <Mascot size={44} />
        </View>
      )}

      {/* Top header with progress */}
      <View style={[styles.topContainer, { top: insets.top + 10 }]}>
        <HeaderPill>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
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
                      outputRange: ['0%', '100%'],
                    }) 
                  }
                ]} 
              />
            </View>
            <Text style={styles.miniProgressText}>
              {totalHours.toFixed(1)}/{HOURS_FOR_REWARD}h
            </Text>
          </View>
          {/* Recording indicator */}
          {isRecording && (
            <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.recordingDot} />
            </Animated.View>
          )}
        </HeaderPill>
        {showExternalToggle && (
          <View style={styles.modeToggleContainer}>
            <CameraModeToggle
              value={cameraMode}
              onChange={handleCameraModeChange}
              externalDisabled={!externalCamera.canSwitchToExternal}
              disabled={isModeTransitioning}
            />
          </View>
        )}
      </View>

      {/* Milestone celebration overlay */}
      {!isExternalMode && currentMilestone && (
        <MilestoneCelebration
          milestone={currentMilestone}
          totalHours={totalHoursUploaded + (elapsedSeconds / 3600)}
          goalHours={10}
          onDismiss={dismissMilestone}
          onTakeBreak={currentMilestone >= 7200 ? () => {
            dismissMilestone();
            stopRecording(); // Will navigate to SessionComplete
          } : undefined}
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
            (isExternalMode && !isExternalReady) || isModeTransitioning
              ? styles.recordButtonDisabled
              : null,
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
          <Text style={styles.statusText} testID="recording-status-text">
            {getStatusMessage()}
          </Text>
        </View>

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
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  backLink: {
    marginTop: 24,
    padding: 10,
  },
  backLinkText: {
    fontSize: 16,
    color: '#888',
  },
  
  // Top header
  topContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  modeToggleContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    overflow: 'hidden',
  },
  headerPillAndroid: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniProgressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginRight: 6,
    gap: 6,
  },
  miniProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  miniProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  recordingIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,59,48,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
  },
  
  // Bottom controls
  bottomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  timerContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  timerText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      ios: {
        fontFamily: 'Helvetica Neue',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  recordButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  recordIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff3b30',
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      },
    }),
  },
  encouragement: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mascotWitness: {
    position: 'absolute',
    bottom: 180,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
