/**
 * CAMERA SCREEN - Cross-Platform with Offline Support
 * Continuous recording with background segment uploads
 * Videos persist locally until confirmed uploaded
 * Uses react-native-vision-camera for physical lens selection
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  Animated,
  Platform,
  AppState,
  AppStateStatus,
  Linking,
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
import { useAuth } from '@/contexts/AuthContext';
import { UploadQueueService } from '@/services/upload-queue.service';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { Toast } from '@/components/Toast';
import CameraModeToggle, { CameraMode } from '@/components/external-camera/CameraModeToggle';
import ExternalCameraPanel from '@/components/external-camera/ExternalCameraPanel';
import { getExternalCameraDisplayState } from '@/components/external-camera/external-camera-display';
import ExternalCameraView from '@/components/external-camera/ExternalCameraView';
import { useToast } from '@/hooks/useToast';
import { useExternalCameraDiagnostics } from '@/hooks/useExternalCameraDiagnostics';
import { ExternalCamera } from '@/native/external-camera';
import { normalizeLocalFileUri } from '@/utils/local-file-uri';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

const SEGMENT_DURATION = 300; // 5 minutes in seconds

type LensType = 'ultra-wide' | 'wide' | 'telephoto';

export default function CameraScreen({ route, navigation }: any) {
  const params = route.params || {};
  const locationId = params.locationId ?? params.location?.id;
  const locationName = params.locationName ?? params.location?.name ?? 'Unknown Location';
  const address = params.address ?? params.location?.address ?? '';
  const jobId = params.jobId ?? params.job?.id;
  const jobTitle = params.jobTitle ?? params.job?.title ?? 'Recording';
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);

  // Permissions
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();

  // Lens selection state - default to ultra-wide
  const [selectedLens, setSelectedLens] = useState<LensType>('wide');
  const [cameraMode, setCameraMode] = useState<CameraMode>('native');
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [nativeCameraMountKey, setNativeCameraMountKey] = useState(0);
  const externalCamera = useExternalCameraDiagnostics();
  const isExternalMode = cameraMode === 'external';
  const isExternalReady = isExternalMode && externalCamera.isReady;
  const isNativeCameraActive = cameraMode === 'native';
  const showExternalToggle = externalCamera.isSupported;
  const isExternalModeRef = useRef(isExternalMode);
  const cameraPermissionStatus =
    hasCameraPermission === null
      ? 'unknown'
      : hasCameraPermission
      ? 'granted'
      : 'denied';

  // Get a device that supports all physical lenses for smooth switching
  const device = useCameraDevice('back', {
    physicalDevices: [
      'ultra-wide-angle-camera',
      'wide-angle-camera',
      'telephoto-camera',
    ],
  });

  // Track which lenses are available on this device
  const availableLenses = {
    'ultra-wide': device?.physicalDevices?.includes('ultra-wide-angle-camera') ?? false,
    'wide': device?.physicalDevices?.includes('wide-angle-camera') ?? true,
    'telephoto': device?.physicalDevices?.includes('telephoto-camera') ?? false,
  };

  // Calculate zoom based on selected lens
  const getZoomForLens = useCallback((lens: LensType): number => {
    switch (lens) {
      case 'ultra-wide':
        return 0.5; // 0.5x zoom triggers ultra-wide lens
      case 'wide':
        return 1.0; // 1x is standard wide
      case 'telephoto':
        return 2.0; // 2x for telephoto
      default:
        return 0.5;
    }
  }, []);

  const currentZoom = getZoomForLens(selectedLens);

  // Upload queue status
  const uploadQueue = useUploadQueue();

  // Toast notifications
  const { toast, showToast, hideToast } = useToast();

  // Recording state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinishingExternalRecording, setIsFinishingExternalRecording] = useState(false);
  const [showExternalQueuedConfirmation, setShowExternalQueuedConfirmation] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [segmentsRecorded, setSegmentsRecorded] = useState(0);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionActiveRef = useRef(false);
  const segmentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const shouldResumeSessionRef = useRef(false);
  const currentSegmentRef = useRef<{
    segmentNumber: number;
    startedAt: string;
    cameraMode: 'external' | 'native';
  } | null>(null);
  const segmentCounterRef = useRef(0);
  const startRecordingSegmentRef = useRef<(() => Promise<void>) | null>(null);
  const externalFinalizeWaitRef = useRef<{
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const externalQueuedConfirmationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Initialize upload queue service
  useEffect(() => {
    UploadQueueService.initialize();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
      }
      if (externalQueuedConfirmationTimeoutRef.current) {
        clearTimeout(externalQueuedConfirmationTimeoutRef.current);
      }
    };
  }, []);

  // Handle app going to background/foreground
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('[Camera] App came to foreground, processing queue');
      UploadQueueService.processQueue();
    }
    appState.current = nextAppState;
  };

  // Pulse animation for recording indicator
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
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Timer for elapsed time
  useEffect(() => {
    if (isSessionActive) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isSessionActive]);

  // Track uploads and show success toast
  const prevTotal = useRef(0);
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    if (segmentsRecorded > 0) {
      hasRecordedRef.current = true;
    }

    if (
      hasRecordedRef.current &&
      prevTotal.current > 0 &&
      uploadQueue.total < prevTotal.current &&
      uploadQueue.uploading === 0
    ) {
      showToast('Video saved successfully', 'success');
    }

    prevTotal.current = uploadQueue.total;
  }, [uploadQueue.total, uploadQueue.uploading, segmentsRecorded, showToast]);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // Truncate address for display
  const truncateAddress = (addr: string, maxLength: number = 28): string => {
    if (!addr) return 'Unknown Location';
    return addr.length > maxLength
      ? addr.substring(0, maxLength) + '...'
      : addr;
  };

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
    const filename = `external-${Date.now()}`;
    return `${recordingsDir}${filename}`;
  }, [ensureExternalRecordingDirectory]);

  const clearExternalFinalizeWait = useCallback(() => {
    const pending = externalFinalizeWaitRef.current;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    externalFinalizeWaitRef.current = null;
    setIsFinishingExternalRecording(false);
  }, []);

  const showQueuedConfirmation = useCallback(() => {
    if (externalQueuedConfirmationTimeoutRef.current) {
      clearTimeout(externalQueuedConfirmationTimeoutRef.current);
    }
    setShowExternalQueuedConfirmation(true);
    externalQueuedConfirmationTimeoutRef.current = setTimeout(() => {
      setShowExternalQueuedConfirmation(false);
      externalQueuedConfirmationTimeoutRef.current = null;
    }, 2500);
  }, []);

  const resolveExternalFinalizeWait = useCallback(() => {
    const pending = externalFinalizeWaitRef.current;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    externalFinalizeWaitRef.current = null;
    setIsFinishingExternalRecording(false);
    pending.resolve();
  }, []);

  const rejectExternalFinalizeWait = useCallback((message: string) => {
    const pending = externalFinalizeWaitRef.current;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    externalFinalizeWaitRef.current = null;
    setIsFinishingExternalRecording(false);
    pending.reject(new Error(message));
  }, []);

  const ensureExternalFinalizeWait = useCallback((): Promise<void> => {
    if (externalFinalizeWaitRef.current) {
      return externalFinalizeWaitRef.current.promise;
    }

    setIsFinishingExternalRecording(true);
    UploadQueueService.logDebug('info', 'Waiting for external recording finalize event');

    let resolveFn!: () => void;
    let rejectFn!: (error: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const timeout = setTimeout(() => {
      UploadQueueService.logDebug(
        'error',
        'Timed out waiting for external recording finalization'
      );
      rejectExternalFinalizeWait('Timed out waiting for external recording finalization.');
    }, 15000);

    externalFinalizeWaitRef.current = {
      promise,
      resolve: resolveFn,
      reject: rejectFn,
      timeout,
    };
    return promise;
  }, [rejectExternalFinalizeWait]);

  async function queueCompletedSegment(
    videoUri: string,
    cameraMode: 'external' | 'native'
  ): Promise<boolean> {
    const segment = currentSegmentRef.current;

    if (!videoUri || !user || !segment || !locationId || !jobId) {
      console.warn('[Camera] Missing job or segment metadata, skipping queue');
      if (cameraMode === 'external') {
        UploadQueueService.logDebug(
          'error',
          'External recording could not be queued because segment metadata was missing',
          JSON.stringify({
            hasVideoUri: !!videoUri,
            hasUser: !!user,
            hasSegment: !!segment,
            hasLocationId: !!locationId,
            hasJobId: !!jobId,
          }),
          'failed'
        );
      }
      return false;
    }

    currentSegmentRef.current = null;
    setSegmentsRecorded((prev) => prev + 1);

    try {
      await UploadQueueService.addToQueue(videoUri, {
        locationId,
        locationName,
        jobId,
        jobTitle,
        segmentNumber: segment.segmentNumber,
        startedAt: segment.startedAt,
        endedAt: new Date().toISOString(),
      });
      if (cameraMode === 'external') {
        UploadQueueService.logDebug(
          'info',
          'External recording segment queued successfully',
          videoUri,
          'queued'
        );
      }
    } catch (error) {
      console.error('[Camera] Failed to queue segment:', error);
      if (cameraMode === 'external') {
        UploadQueueService.logDebug(
          'error',
          'External recording segment failed to enter upload queue',
          String(error),
          'failed'
        );
      }
      Alert.alert(
        'Upload Queue Error',
        'This segment could not be saved for background upload.'
      );
      return false;
    }

    if (sessionActiveRef.current) {
      console.log('[Camera] Starting next segment...');
      await startRecordingSegmentRef.current?.();
    }

    return true;
  }

  // Handle recording stopped callback
  const onRecordingFinished = useCallback(
    async (video: VideoFile) => {
      console.log('[Camera] Segment complete:', video.path);
      setIsRecording(false);
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
        segmentTimeoutRef.current = null;
      }
      if (video?.path && user) {
        // Convert path to file:// URI if needed
        const videoUri = video.path.startsWith('file://') 
          ? video.path 
          : `file://${video.path}`;

        await queueCompletedSegment(videoUri, 'native');
      }
    },
    [user]
  );

  const onRecordingError = useCallback((error: any) => {
    console.error('[Camera] Recording error:', error);
    setIsRecording(false);
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
    currentSegmentRef.current = null;
    segmentCounterRef.current = Math.max(0, segmentCounterRef.current - 1);
    // If session active, try to recover
    if (sessionActiveRef.current) {
      setTimeout(() => startRecordingSegment(), 1000);
    }
  }, []);

  const startExternalRecordingSegment = useCallback(async () => {
    if (!ExternalCamera.isSupported || !sessionActiveRef.current) {
      return;
    }

    try {
      const outputPath = await createExternalRecordingPath();
      setIsRecording(true);
      console.log('[ExternalCamera] Recording segment...');

      await ExternalCamera.startRecording(outputPath, {
        enableAudio: false,
        quality: 'hd',
      });

      segmentTimeoutRef.current = setTimeout(() => {
        if (sessionActiveRef.current) {
          console.log('[ExternalCamera] Segment duration reached, stopping...');
          ExternalCamera.stopRecording();
        }
      }, SEGMENT_DURATION * 1000);
    } catch (error: any) {
      console.error('[ExternalCamera] Start recording error:', error);
      setIsRecording(false);
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
        segmentTimeoutRef.current = null;
      }
      currentSegmentRef.current = null;
      segmentCounterRef.current = Math.max(0, segmentCounterRef.current - 1);
    }
  }, [createExternalRecordingPath]);

  const handleExternalRecordingFinished = useCallback(
    async (filePath: string) => {
      console.log('[ExternalCamera] Segment complete:', filePath);
      UploadQueueService.logDebug('info', 'External finalize event received', filePath);
      setIsRecording(false);

      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
        segmentTimeoutRef.current = null;
      }

      if (filePath && user) {
        const videoUri = normalizeLocalFileUri(filePath);
        try {
          const fileInfo = await FileSystem.getInfoAsync(videoUri);
          const fileSize =
            'size' in fileInfo && typeof fileInfo.size === 'number' ? fileInfo.size : 0;
          if (!fileInfo.exists || fileSize <= 0) {
            UploadQueueService.logDebug(
              'error',
              'External recording finalized without a usable MP4 file',
              JSON.stringify({
                path: videoUri,
                exists: fileInfo.exists,
                size: fileSize,
              }),
              'failed'
            );
            rejectExternalFinalizeWait('External recording did not produce a valid MP4 file.');
            return;
          }
          UploadQueueService.logDebug(
            'info',
            'Queueing finalized external recording segment',
            JSON.stringify({
              path: videoUri,
              size: fileSize,
            }),
            'queued'
          );
          const queued = await queueCompletedSegment(videoUri, 'external');
          if (queued) {
            if (!sessionActiveRef.current) {
              showQueuedConfirmation();
            }
            resolveExternalFinalizeWait();
          } else {
            rejectExternalFinalizeWait('External recording finished, but queueing failed.');
          }
        } catch (error: any) {
          rejectExternalFinalizeWait(
            error?.message || 'External recording finished, but queueing failed.'
          );
        }
      } else {
        rejectExternalFinalizeWait('External recording finalized without a file path.');
      }
    },
    [
      queueCompletedSegment,
      rejectExternalFinalizeWait,
      resolveExternalFinalizeWait,
      showQueuedConfirmation,
      user,
    ]
  );

  const handleExternalRecordingError = useCallback(
    (message?: string) => {
      console.error('[ExternalCamera] Recording error:', message);
      UploadQueueService.logDebug(
        'error',
        'External recording reported an error',
        message || 'Unknown external camera error',
        'failed'
      );
      setIsRecording(false);
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
        segmentTimeoutRef.current = null;
      }
      currentSegmentRef.current = null;
      segmentCounterRef.current = Math.max(0, segmentCounterRef.current - 1);
      rejectExternalFinalizeWait(message || 'External recording failed before finalization.');
    },
    [rejectExternalFinalizeWait]
  );

  useEffect(() => {
    if (!ExternalCamera.isSupported) {
      return;
    }

    const subscription = ExternalCamera.addRecordingStateListener((event) => {
      if (!isExternalModeRef.current) {
        return;
      }

      if (event.state === 'finalized' && event.filePath) {
        handleExternalRecordingFinished(event.filePath);
        return;
      }

      if (event.state === 'error') {
        handleExternalRecordingError(event.message);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [handleExternalRecordingError, handleExternalRecordingFinished]);

  // Start recording a segment
  const startRecordingSegment = useCallback(async () => {
    if (!sessionActiveRef.current) return;

    segmentCounterRef.current += 1;
    currentSegmentRef.current = {
      segmentNumber: segmentCounterRef.current,
      startedAt: new Date().toISOString(),
      cameraMode: isExternalModeRef.current ? 'external' : 'native',
    };

    if (isExternalModeRef.current) {
      await startExternalRecordingSegment();
      return;
    }

    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      console.log('[Camera] Recording segment...');

      cameraRef.current.startRecording({
        onRecordingFinished,
        onRecordingError,
        fileType: 'mp4',
        videoCodec: 'h264',
      });

      // Stop after segment duration
      segmentTimeoutRef.current = setTimeout(() => {
        if (cameraRef.current && sessionActiveRef.current) {
          console.log('[Camera] Segment duration reached, stopping...');
          cameraRef.current.stopRecording();
        }
      }, SEGMENT_DURATION * 1000);
    } catch (error: any) {
      console.error('[Camera] Start recording error:', error);
      setIsRecording(false);
      currentSegmentRef.current = null;
      segmentCounterRef.current = Math.max(0, segmentCounterRef.current - 1);
      if (sessionActiveRef.current) {
        setTimeout(() => startRecordingSegment(), 1000);
      }
    }
  }, [onRecordingFinished, onRecordingError, startExternalRecordingSegment]);

  useEffect(() => {
    startRecordingSegmentRef.current = startRecordingSegment;
  }, [startRecordingSegment]);

  // Start recording session
  const startSession = useCallback(async () => {
    console.log('[Camera] Starting session...');
    if (!user || !locationId || !jobId) {
      Alert.alert('Unable to Start', 'Missing location or job details for this recording session.');
      return;
    }

    try {
      currentSegmentRef.current = null;
      segmentCounterRef.current = 0;

      setIsSessionActive(true);
      sessionActiveRef.current = true;
      setElapsedTime(0);
      setSegmentsRecorded(0);

      await startRecordingSegment();
    } catch (error: any) {
      console.error('[Camera] Failed to start session:', error);
      currentSegmentRef.current = null;
      segmentCounterRef.current = 0;
      Alert.alert('Unable to Start Recording', error?.message || 'Failed to start recording.');
    }
  }, [jobId, locationId, startRecordingSegment, user]);

  // Stop recording session
  const stopSession = useCallback(async () => {
    console.log('[Camera] Stopping session...');
    setIsSessionActive(false);
    sessionActiveRef.current = false;

    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }

    if (isExternalModeRef.current) {
      const shouldWaitForFinalize = isRecording || !!currentSegmentRef.current;
      const finalizePromise = shouldWaitForFinalize ? ensureExternalFinalizeWait() : null;
      UploadQueueService.logDebug(
        'info',
        'External recording stop requested',
        shouldWaitForFinalize ? 'Awaiting finalize before leaving camera screen' : undefined
      );
      try {
        await ExternalCamera.stopRecording();
        if (finalizePromise) {
          await finalizePromise;
        }
      } catch (error) {
        console.warn('[ExternalCamera] Stop recording error:', error);
        clearExternalFinalizeWait();
        throw error;
      }
    } else if (cameraRef.current && isRecording) {
      await cameraRef.current.stopRecording();
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [clearExternalFinalizeWait, ensureExternalFinalizeWait, isRecording]);

  // Handle record button press
  const handleRecordPress = () => {
    if (isModeTransitioning || isFinishingExternalRecording) {
      return;
    }
    if (isSessionActive) {
      void stopSession().catch((error: any) => {
        Alert.alert(
          'Could Not Finish Recording',
          error?.message || 'The recording could not be finalized for upload.'
        );
      });
      return;
    }
    if (isExternalMode && !isExternalReady) {
      Alert.alert(
        'External Camera',
        externalCamera.statusMessage
      );
      return;
    }
    startSession();
  };

  // Handle back/close
  const handleClose = () => {
    if (isSessionActive) {
      Alert.alert(
        'Stop Recording?',
        'This will end your session. All recorded segments are saved locally and will upload automatically.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop & Exit',
            style: 'destructive',
            onPress: async () => {
              try {
                await stopSession();
                navigation.goBack();
              } catch (error: any) {
                Alert.alert(
                  'Could Not Finish Recording',
                  error?.message || 'The recording could not be finalized for upload.'
                );
              }
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const openUploadQueue = () => {
    navigation.navigate('UploadQueue');
  };

  // Handle lens change
  const handleLensChange = (lens: LensType) => {
    if (availableLenses[lens]) {
      setSelectedLens(lens);
      Haptics.selectionAsync();
    }
  };

  const handleCameraModeChange = async (mode: CameraMode) => {
    if (mode === cameraMode || isModeTransitioning) {
      return;
    }

    setIsModeTransitioning(true);
    const wasSessionActive = isSessionActive;
    if (wasSessionActive) {
      await stopSession();
      shouldResumeSessionRef.current = true;
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
    if (!shouldResumeSessionRef.current) {
      return;
    }

    if (isModeTransitioning) {
      return;
    }

    if (cameraMode === 'external' && !isExternalReady) {
      return;
    }

    shouldResumeSessionRef.current = false;
    startSession();
  }, [cameraMode, isExternalReady, isModeTransitioning, startSession]);

  useEffect(() => {
    if (!isExternalMode || isSessionActive) {
      setShowExternalQueuedConfirmation(false);
    }
  }, [isExternalMode, isSessionActive]);

  const externalDisplay = getExternalCameraDisplayState({
    supportState: externalCamera.supportState,
    connectionPhase: externalCamera.connectionPhase,
    sessionState: externalCamera.sessionState,
    statusMessage: externalCamera.statusMessage,
    hasLivePreview: externalCamera.hasLivePreview,
    recordingActive: isSessionActive,
    isModeTransitioning,
    isFinishingRecording: isFinishingExternalRecording,
    showQueuedConfirmation: showExternalQueuedConfirmation,
  });

  // Get status message
  const getStatusMessage = (): string => {
    if (isModeTransitioning) {
      return 'Switching camera...';
    }

    if (isExternalMode) {
      return externalDisplay.footerMessage;
    }

    if (isSessionActive) {
      if (segmentsRecorded === 0) {
        return 'Recording...';
      }
      return `${segmentsRecorded} segment${segmentsRecorded > 1 ? 's' : ''} saved`;
    }

    if (uploadQueue.total > 0) {
      if (uploadQueue.isUploading) {
        return `Uploading ${uploadQueue.uploading} of ${uploadQueue.total}...`;
      }
      if (uploadQueue.failed > 0) {
        return `${uploadQueue.failed} failed • Tap to retry`;
      }
      return `${uploadQueue.pending} pending upload${uploadQueue.pending > 1 ? 's' : ''}`;
    }

    return 'Tap to start recording';
  };

  // Get lens display text
  const getLensDisplayText = (lens: LensType): string => {
    switch (lens) {
      case 'ultra-wide':
        return '.5';
      case 'wide':
        return '1x';
      case 'telephoto':
        return '2x';
    }
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
    return (
      <View style={[styles.headerPill, styles.headerPillAndroid]}>
        {children}
      </View>
    );
  };

  // Request permissions
  const requestPermissions = async () => {
    const cameraGranted = await requestCameraPermission();
    const micGranted = await requestMicPermission();
    return cameraGranted && micGranted;
  };

  // Permission not yet determined
  if (hasCameraPermission === null || hasMicPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Permission denied
  if (!hasCameraPermission || !hasMicPermission) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="camera-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          We need camera and microphone access to record your session.
        </Text>
        <TouchableOpacity
          onPress={requestPermissions}
          style={styles.permissionButton}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No camera device available
  if (!device) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="camera-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>No Camera Found</Text>
        <Text style={styles.permissionText}>
          Unable to access camera device.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Missing location/user
  if (!locationId || !user) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="location-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Missing Information</Text>
        <Text style={styles.permissionText}>
          Location and job information are required to start recording.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main camera view
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Toast notification */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />

      {/* Full-screen camera */}
      {isExternalMode && showExternalToggle ? (
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
                <ExternalCameraView
                  style={StyleSheet.absoluteFill}
                />
              ) : undefined
            }
            showPreviewPlaceholder={externalDisplay.showPreviewPlaceholder}
            style={{
              paddingTop: insets.top + 120,
              paddingBottom: insets.bottom + 160,
            }}
          />
        </View>
      ) : (
        <Camera
          key={`native-camera-${nativeCameraMountKey}`}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isNativeCameraActive}
          video={true}
          audio={true}
          zoom={currentZoom}
        />
      )}

      {/* Top floating header */}
      <View style={[styles.topContainer, { top: insets.top + 10 }]}>
        <HeaderPill>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.locationContainer}>
            <Ionicons
              name="location"
              size={14}
              color="rgba(255,255,255,0.8)"
              style={styles.locationIcon}
            />
            <Text style={styles.addressText} numberOfLines={1}>
              {truncateAddress(address)}
            </Text>
          </View>

          {isSessionActive && (
            <Animated.View
              style={[
                styles.recordingIndicator,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={styles.recordingDot} />
            </Animated.View>
          )}

          {/* Queue indicator when not recording */}
          {!isSessionActive && uploadQueue.total > 0 && (
            <TouchableOpacity
              onPress={openUploadQueue}
              style={styles.queueBadge}
              activeOpacity={0.8}
            >
              <Text style={styles.queueBadgeText}>{uploadQueue.total}</Text>
            </TouchableOpacity>
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

      {/* Bottom floating controls */}
      <View style={[styles.bottomContainer, { bottom: insets.bottom + 30 }]}>
        {/* Lens selector */}
        {!isExternalMode && (
          <View style={styles.lensSelector}>
            {(['ultra-wide', 'wide', 'telephoto'] as LensType[]).map((lens) => (
              <TouchableOpacity
                key={lens}
                onPress={() => handleLensChange(lens)}
                style={[
                  styles.lensButton,
                  selectedLens === lens && styles.lensButtonActive,
                  !availableLenses[lens] && styles.lensButtonDisabled,
                ]}
                activeOpacity={0.7}
                disabled={!availableLenses[lens]}
              >
                <Text
                  style={[
                    styles.lensText,
                    selectedLens === lens && styles.lensTextActive,
                    !availableLenses[lens] && styles.lensTextDisabled,
                  ]}
                >
                  {getLensDisplayText(lens)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Timer display */}
        {isSessionActive && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
        )}

        {/* Record button */}
        <TouchableOpacity
          onPress={handleRecordPress}
          style={[
            styles.recordButtonOuter,
            (isExternalMode && !isExternalReady) ||
            isModeTransitioning ||
            isFinishingExternalRecording
              ? styles.recordButtonDisabled
              : null,
          ]}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.recordButtonInner,
              isSessionActive && styles.recordButtonActive,
            ]}
          >
            {isSessionActive ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={styles.recordIcon} />
            )}
          </View>
        </TouchableOpacity>

        {/* Status text */}
        <TouchableOpacity
          style={styles.statusContainer}
          onPress={uploadQueue.total > 0 ? openUploadQueue : undefined}
          activeOpacity={uploadQueue.total > 0 ? 0.7 : 1}
        >
          {(isExternalMode ? externalDisplay.showSpinner : uploadQueue.isUploading) && (
            <ActivityIndicator
              size="small"
              color="rgba(255,255,255,0.8)"
              style={styles.uploadingSpinner}
            />
          )}
          <Text
            style={[
              styles.statusText,
              uploadQueue.failed > 0 && styles.statusTextWarning,
            ]}
          >
            {getStatusMessage()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
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
    borderRadius: 28,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    overflow: 'hidden',
  },
  headerPillAndroid: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 8,
  },
  locationIcon: {
    marginRight: 6,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
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
  queueBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Bottom controls
  bottomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  // Lens selector
  lensSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 22,
    padding: 3,
  },
  lensButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lensButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  lensButtonDisabled: {
    opacity: 0.3,
  },
  lensText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  lensTextActive: {
    color: '#FFD60A',
  },
  lensTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
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
  },
  uploadingSpinner: {
    marginRight: 8,
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
  statusTextWarning: {
    color: '#FFD60A',
  },
});
