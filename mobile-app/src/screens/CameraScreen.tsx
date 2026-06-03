/**
 * CAMERA SCREEN - External UVC camera only, audio disabled.
 * Used by CleanerNavigator (location_cleaner role).
 * Continuous segmented recording with background uploads.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useCameraPermission } from "react-native-vision-camera";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { UploadQueueService } from "@/services/upload-queue.service";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import { Toast } from "@/components/Toast";
import ExternalCameraPanel from "@/components/external-camera/ExternalCameraPanel";
import { getExternalCameraDisplayState } from "@/components/external-camera/external-camera-display";
import ExternalCameraView from "@/components/external-camera/ExternalCameraView";
import { useToast } from "@/hooks/useToast";
import { useExternalCameraDiagnostics } from "@/hooks/useExternalCameraDiagnostics";
import { ExternalCamera } from "@/native/external-camera";
import { normalizeLocalFileUri } from "@/utils/local-file-uri";
import { getFriendlyErrorCopy } from "@/utils/user-facing-error";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useRecordingConfig } from "@/hooks/useRecordingConfig";
import {
  locationService,
  findNearestAssignedLocation,
} from "@/services/location.service";
import {
  getAssignedLocationsCacheFirst,
  refreshAssignedLocationsInBackground,
} from "@/services/api";
import { useFocusEffect } from "@react-navigation/native";

export default function CameraScreen({ route, navigation }: any) {
  const params = route.params || {};
  const isGenericRecording = Boolean(params.genericRecording);
  const explicitLocationId = params.locationId ?? params.location?.id;
  const explicitLocationName = params.locationName ?? params.location?.name;
  const explicitAddress = params.address ?? params.location?.address;
  const jobId = params.jobId ?? params.job?.id;
  const jobTitle = params.jobTitle ?? params.job?.title ?? "Recording";
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Auto mode: cleaner landed on the camera with no explicit location and not
  // generic — resolve the GPS-nearest assigned location and bind it silently.
  const isAutoMode = !isGenericRecording && !explicitLocationId;
  const [autoLocation, setAutoLocation] = useState<{
    id: string;
    name: string;
    address: string;
  } | null>(null);
  // 'resolving' → fetching GPS + nearest; 'resolved' → bound; 'no-match' → no
  // nearby assigned location (or none have coords); 'denied' → no location
  // permission / no GPS fix (camera disabled until fixed).
  const [locationResolveStatus, setLocationResolveStatus] = useState<
    "resolving" | "resolved" | "no-match" | "denied"
  >(isAutoMode ? "resolving" : "resolved");

  // Effective location used everywhere downstream (explicit param wins, else
  // the auto-resolved one). Job stays optional.
  const locationId = explicitLocationId ?? autoLocation?.id;
  const locationName =
    explicitLocationName ?? autoLocation?.name ?? "Unknown Location";
  const address = explicitAddress ?? autoLocation?.address ?? "";

  // Permissions
  const {
    hasPermission: hasCameraPermission,
    requestPermission: requestCameraPermission,
  } = useCameraPermission();

  const externalCamera = useExternalCameraDiagnostics();
  const isExternalReady = externalCamera.isReady;
  const cameraPermissionStatus =
    hasCameraPermission === null
      ? "unknown"
      : hasCameraPermission
        ? "granted"
        : "denied";

  // Recording config (segment duration, quality, etc.)
  const recordingConfig = useRecordingConfig();

  // Upload queue status
  const uploadQueue = useUploadQueue();

  // Toast notifications
  const { toast, showToast, hideToast } = useToast();

  // Recording state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinishingExternalRecording, setIsFinishingExternalRecording] =
    useState(false);
  const [showExternalQueuedConfirmation, setShowExternalQueuedConfirmation] =
    useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [segmentsRecorded, setSegmentsRecorded] = useState(0);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionActiveRef = useRef(false);
  // Monotonic id bumped on every start AND stop. Asynchronous finalize handlers
  // capture this at fire time; if it has moved by the time they run the
  // restart branch (user stopped and started a new session in the gap), the
  // restart is skipped so we don't try to start while native is already
  // recording.
  const sessionIdRef = useRef(0);
  const segmentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const currentSegmentRef = useRef<{
    segmentNumber: number;
    startedAt: string;
  } | null>(null);
  const segmentCounterRef = useRef(0);
  const startRecordingSegmentRef = useRef<(() => Promise<void>) | null>(null);
  // Late-bound ref so the USB-detach listener (registered once at mount) can
  // invoke the latest stopSession without needing it in its useEffect deps.
  const stopSessionRef = useRef<(() => Promise<void>) | null>(null);
  const geoRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const externalFinalizeWaitRef = useRef<{
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const externalQueuedConfirmationTimeoutRef = useRef<NodeJS.Timeout | null>(
    null,
  );

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

  // Request location permission AND pre-fetch coords on mount so the first
  // segment of a session has GPS without delaying the record tap.
  useEffect(() => {
    locationService
      .requestPermission()
      .then((granted) => {
        if (granted) return locationService.getCurrentCoordinates();
        return null;
      })
      .then((coords) => {
        if (coords) geoRef.current = coords;
      })
      .catch(() => {});
  }, []);

  // Resolve the GPS-nearest assigned location. Enforces location access: no
  // permission or no fix → 'denied' (camera disabled). No nearby assigned
  // location → 'no-match' (prompt to pick from the list).
  const resolveNearestLocation = useCallback(async (): Promise<void> => {
    try {
      const granted = await locationService.requestPermission();
      if (!granted) {
        setLocationResolveStatus("denied");
        return;
      }

      // Fast path: last-known GPS (instant, no fix) + cached list → bind now so
      // the camera is usable without waiting on a fresh fix or the network.
      const fastCoords =
        (await locationService.getLastKnownCoordinates()) ?? geoRef.current;
      const cache = await getAssignedLocationsCacheFirst();
      let boundFromCache = false;
      if (fastCoords && cache.locations.length > 0) {
        const nearest = findNearestAssignedLocation(
          fastCoords,
          cache.locations,
        );
        if (nearest) {
          geoRef.current = fastCoords;
          setAutoLocation({
            id: nearest.location.id,
            name: nearest.location.name,
            address: nearest.location.address ?? "",
          });
          setLocationResolveStatus("resolved");
          boundFromCache = true;
        }
      }

      // Only spin if nothing could be bound yet (genuine cold start).
      if (!boundFromCache) setLocationResolveStatus("resolving");

      // Background: precise GPS fix, plus a list refresh only when the cache is
      // stale or we had nothing to bind. Re-bind only if the nearest changed.
      const [freshCoords, freshLocations] = await Promise.all([
        locationService.getCurrentCoordinates(),
        cache.stale || !boundFromCache
          ? refreshAssignedLocationsInBackground()
          : Promise.resolve(cache.locations),
      ]);

      const coords = freshCoords ?? fastCoords;
      if (!coords) {
        if (!boundFromCache) setLocationResolveStatus("denied");
        return;
      }
      geoRef.current = coords;

      const list = freshLocations.length ? freshLocations : cache.locations;
      const nearest = findNearestAssignedLocation(coords, list);
      if (nearest) {
        setAutoLocation((prev) =>
          prev?.id === nearest.location.id
            ? prev
            : {
                id: nearest.location.id,
                name: nearest.location.name,
                address: nearest.location.address ?? "",
              },
        );
        setLocationResolveStatus("resolved");
      } else if (!boundFromCache) {
        setLocationResolveStatus("no-match");
      }
    } catch (error) {
      console.warn("[Camera] Failed to resolve nearest location", error);
      // Keep a cache-bound location if we have one; only fail hard on cold start.
      setLocationResolveStatus((prev) =>
        prev === "resolved" ? prev : "no-match",
      );
    }
  }, []);

  // Re-resolve every time the screen gains focus (per decision: refresh on
  // every app open). Only in auto mode — explicit/generic flows keep their param.
  useFocusEffect(
    useCallback(() => {
      if (!isAutoMode) return;
      let cancelled = false;
      // resolveNearestLocation has no external deps; guard against unmount.
      (async () => {
        if (!cancelled) await resolveNearestLocation();
      })();
      return () => {
        cancelled = true;
      };
    }, [isAutoMode, resolveNearestLocation]),
  );

  // Initialize upload queue service
  useEffect(() => {
    UploadQueueService.initialize();

    // Handle app state changes
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

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
      nextAppState === "active"
    ) {
      console.log("[Camera] App came to foreground, processing queue");
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
        ]),
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
  const prevFailedCount = useRef(0);
  const hasRecordedRef = useRef(false);
  const hasObservedFailedUploadsRef = useRef(false);

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
      showToast("Video saved successfully", "success");
    }

    prevTotal.current = uploadQueue.total;
  }, [uploadQueue.total, uploadQueue.uploading, segmentsRecorded, showToast]);

  useEffect(() => {
    if (!hasObservedFailedUploadsRef.current) {
      hasObservedFailedUploadsRef.current = true;
      prevFailedCount.current = uploadQueue.failed;
      return;
    }

    if (uploadQueue.failed > prevFailedCount.current) {
      showToast(
        "Upload failed. Open Failed uploads to retry or delete.",
        "error",
      );
    }

    prevFailedCount.current = uploadQueue.failed;
  }, [showToast, uploadQueue.failed]);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Truncate address for display
  const truncateAddress = (addr: string, maxLength: number = 28): string => {
    if (!addr) return "Unknown Location";
    return addr.length > maxLength
      ? addr.substring(0, maxLength) + "..."
      : addr;
  };
  const headerLabel = isGenericRecording
    ? "Generic recording"
    : isAutoMode && locationResolveStatus === "resolving"
      ? "Locating…"
      : truncateAddress(
          locationName !== "Unknown Location" ? locationName : address,
        );
  const canOpenQueueDetails =
    uploadQueue.failed > 0 || uploadQueue.needsAssignment > 0;

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
    UploadQueueService.logDebug(
      "info",
      "Waiting for external recording finalize event",
    );

    let resolveFn!: () => void;
    let rejectFn!: (error: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const timeout = setTimeout(() => {
      UploadQueueService.logDebug(
        "error",
        "Timed out waiting for external recording finalization",
      );
      rejectExternalFinalizeWait(
        "Timed out waiting for external recording finalization.",
      );
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
    handlerSessionId: number,
  ): Promise<boolean> {
    const segment = currentSegmentRef.current;

    if (
      !videoUri ||
      !user ||
      !segment ||
      (!isGenericRecording && !locationId)
    ) {
      console.warn(
        "[Camera] Missing location or segment metadata, skipping queue",
      );
      UploadQueueService.logDebug(
        "error",
        "External recording could not be queued because segment metadata was missing",
        JSON.stringify({
          hasVideoUri: !!videoUri,
          hasUser: !!user,
          hasSegment: !!segment,
          hasLocationId: !!locationId,
          hasJobId: !!jobId,
          isGenericRecording,
        }),
        "failed",
      );
      return false;
    }

    currentSegmentRef.current = null;
    setSegmentsRecorded((prev) => prev + 1);

    try {
      await UploadQueueService.addToQueue(videoUri, {
        locationId: isGenericRecording ? undefined : locationId,
        locationName: isGenericRecording ? undefined : locationName,
        // Job is optional: a location-bound recording uploads without one and
        // gets its job assigned later on the dashboard.
        jobId: isGenericRecording ? undefined : jobId,
        jobTitle: isGenericRecording
          ? "Generic recording"
          : jobId
            ? jobTitle
            : undefined,
        segmentNumber: segment.segmentNumber,
        startedAt: segment.startedAt,
        endedAt: new Date().toISOString(),
        recordingMode: isGenericRecording ? "generic" : "assigned",
        latitude: geoRef.current?.latitude,
        longitude: geoRef.current?.longitude,
      });
      UploadQueueService.logDebug(
        "info",
        "External recording segment queued successfully",
        videoUri,
        "queued",
      );
    } catch (error) {
      console.error("[Camera] Failed to queue segment:", error);
      UploadQueueService.logDebug(
        "error",
        "External recording segment failed to enter upload queue",
        String(error),
        "failed",
      );
      const friendly = getFriendlyErrorCopy(error, "queue");
      Alert.alert(friendly.title, friendly.message);
      return false;
    }

    // Only restart if the session id is still the one this handler captured.
    // Guards the case where user stopped (and possibly started a new session)
    // while addToQueue was in flight — old finalize must not race the new
    // session's startRecording.
    if (sessionActiveRef.current && sessionIdRef.current === handlerSessionId) {
      console.log("[Camera] Starting next segment...");
      await startRecordingSegmentRef.current?.();
    }

    return true;
  }

  const startExternalRecordingSegment = useCallback(async () => {
    if (!ExternalCamera.isSupported || !sessionActiveRef.current) {
      return;
    }

    try {
      const outputPath = await createExternalRecordingPath();
      setIsRecording(true);
      console.log("[ExternalCamera] Recording segment...");

      await ExternalCamera.startRecording(outputPath, {
        enableAudio: false,
        quality: "hd",
      });

      segmentTimeoutRef.current = setTimeout(() => {
        if (sessionActiveRef.current) {
          console.log("[ExternalCamera] Segment duration reached, stopping...");
          ExternalCamera.stopRecording();
        }
      }, recordingConfig.segmentDurationSeconds * 1000);
    } catch (error: any) {
      console.error("[ExternalCamera] Start recording error:", error);
      setIsRecording(false);
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
        segmentTimeoutRef.current = null;
      }
      currentSegmentRef.current = null;
      segmentCounterRef.current = Math.max(0, segmentCounterRef.current - 1);
    }
  }, [createExternalRecordingPath, recordingConfig.segmentDurationSeconds]);

  const handleExternalRecordingFinished = useCallback(
    async (filePath: string) => {
      // Snapshot session id at the moment finalize arrives. queueCompletedSegment
      // re-checks this before restarting so a stale finalize can't kick off a
      // segment in a different session that began while addToQueue ran.
      const handlerSessionId = sessionIdRef.current;
      console.log("[ExternalCamera] Segment complete:", filePath);
      UploadQueueService.logDebug(
        "info",
        "External finalize event received",
        filePath,
      );
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
            "size" in fileInfo && typeof fileInfo.size === "number"
              ? fileInfo.size
              : 0;
          if (!fileInfo.exists || fileSize <= 0) {
            UploadQueueService.logDebug(
              "error",
              "External recording finalized without a usable MP4 file",
              JSON.stringify({
                path: videoUri,
                exists: fileInfo.exists,
                size: fileSize,
              }),
              "failed",
            );
            rejectExternalFinalizeWait(
              "External recording did not produce a valid MP4 file.",
            );
            return;
          }
          UploadQueueService.logDebug(
            "info",
            "Queueing finalized external recording segment",
            JSON.stringify({
              path: videoUri,
              size: fileSize,
            }),
            "queued",
          );
          const queued = await queueCompletedSegment(
            videoUri,
            handlerSessionId,
          );
          if (queued) {
            if (!sessionActiveRef.current) {
              showQueuedConfirmation();
            }
            resolveExternalFinalizeWait();
          } else {
            rejectExternalFinalizeWait(
              "External recording finished, but queueing failed.",
            );
          }
        } catch (error: any) {
          rejectExternalFinalizeWait(
            "External recording finished, but queueing failed.",
          );
        }
      } else {
        rejectExternalFinalizeWait(
          "External recording finalized without a file path.",
        );
      }
    },
    [
      queueCompletedSegment,
      rejectExternalFinalizeWait,
      resolveExternalFinalizeWait,
      showQueuedConfirmation,
      user,
    ],
  );

  const handleExternalRecordingError = useCallback(
    (message?: string) => {
      console.error("[ExternalCamera] Recording error:", message);
      UploadQueueService.logDebug(
        "error",
        "External recording reported an error",
        message || "Unknown external camera error",
        "failed",
      );
      setIsRecording(false);
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
        segmentTimeoutRef.current = null;
      }
      currentSegmentRef.current = null;
      segmentCounterRef.current = Math.max(0, segmentCounterRef.current - 1);
      rejectExternalFinalizeWait(
        message || "External recording failed before finalization.",
      );
    },
    [rejectExternalFinalizeWait],
  );

  useEffect(() => {
    if (!ExternalCamera.isSupported) {
      return;
    }

    const subscription = ExternalCamera.addRecordingStateListener((event) => {
      if (event.state === "finalized" && event.filePath) {
        handleExternalRecordingFinished(event.filePath);
        return;
      }

      if (event.state === "error") {
        handleExternalRecordingError(event.message);
      }
    });

    // Camera unplug mid-session: tear down the session so the auto-segment
    // loop can't try to restart on a missing device, and surface a clear
    // alert. Native auto-stops the encoder on detach so the in-progress
    // partial file still finalizes and gets queued by handleExternalRecordingFinished.
    const detachSubscription = ExternalCamera.addUsbDetachListener(() => {
      // Either flag being true means we still have a live session to tear
      // down. sessionActiveRef captures the session loop state; isRecordingRef
      // captures the current native-recording flag.
      if (!sessionActiveRef.current) return;

      // Immediate UI feedback before stopSession's async terminal wait.
      setIsRecording(false);

      stopSessionRef.current?.().catch((error: any) => {
        console.error("[Camera] USB detach teardown error:", error);
      });

      Alert.alert(
        "Camera Disconnected",
        "Your camera was unplugged. The recording up to that point has been saved. Reconnect the camera to start a new session.",
      );
    });

    return () => {
      subscription?.remove();
      detachSubscription?.remove();
    };
  }, [handleExternalRecordingError, handleExternalRecordingFinished]);

  // Start recording a segment
  const startRecordingSegment = useCallback(async () => {
    if (!sessionActiveRef.current) return;

    segmentCounterRef.current += 1;
    currentSegmentRef.current = {
      segmentNumber: segmentCounterRef.current,
      startedAt: new Date().toISOString(),
    };

    await startExternalRecordingSegment();
  }, [startExternalRecordingSegment]);

  useEffect(() => {
    startRecordingSegmentRef.current = startRecordingSegment;
  }, [startRecordingSegment]);

  // Start recording session
  const startSession = useCallback(async () => {
    console.log("[Camera] Starting session...");
    if (!user || (!isGenericRecording && !locationId)) {
      Alert.alert(
        "Unable to Start",
        "Missing location for this recording session.",
      );
      return;
    }

    try {
      currentSegmentRef.current = null;
      segmentCounterRef.current = 0;

      setIsSessionActive(true);
      sessionActiveRef.current = true;
      // Bump session id so any stale finalize handler still in flight from a
      // previous session sees a mismatched id and skips its restart branch.
      sessionIdRef.current += 1;
      setElapsedTime(0);
      setSegmentsRecorded(0);

      // Best-effort GPS for the FIRST segment: if mount-time prefetch hasn't
      // populated geoRef yet, try a quick fix with a 500ms cap so the record
      // tap isn't blocked. Background refresh keeps later segments fresh.
      if (geoRef.current === null) {
        await Promise.race([
          locationService
            .getCurrentCoordinates()
            .then((coords) => {
              if (coords) geoRef.current = coords;
            })
            .catch(() => {}),
          new Promise<void>((resolve) => setTimeout(resolve, 500)),
        ]);
      }
      locationService
        .getCurrentCoordinates()
        .then((coords) => {
          if (coords) geoRef.current = coords;
        })
        .catch(() => {});

      await startRecordingSegment();
    } catch (error: any) {
      console.error("[Camera] Failed to start session:", error);
      currentSegmentRef.current = null;
      segmentCounterRef.current = 0;
      const friendly = getFriendlyErrorCopy(error, "recording");
      Alert.alert(friendly.title, friendly.message);
    }
  }, [isGenericRecording, jobId, locationId, startRecordingSegment, user]);

  // Stop recording session
  const stopSession = useCallback(async () => {
    console.log("[Camera] Stopping session...");
    setIsSessionActive(false);
    sessionActiveRef.current = false;
    // Bump session id so any in-flight finalize handler aborts its restart
    // branch even if sessionActiveRef gets flipped back to true by a
    // subsequent startSession before the handler resumes.
    sessionIdRef.current += 1;

    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }

    const shouldWaitForFinalize = isRecording || !!currentSegmentRef.current;
    const finalizePromise = shouldWaitForFinalize
      ? ensureExternalFinalizeWait()
      : null;
    UploadQueueService.logDebug(
      "info",
      "External recording stop requested",
      shouldWaitForFinalize
        ? "Awaiting finalize before leaving camera screen"
        : undefined,
    );
    try {
      await ExternalCamera.stopRecording();
      if (finalizePromise) {
        await finalizePromise;
      }
    } catch (error) {
      console.warn("[ExternalCamera] Stop recording error:", error);
      clearExternalFinalizeWait();
      throw error;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [clearExternalFinalizeWait, ensureExternalFinalizeWait, isRecording]);

  // Keep ref synced to latest stopSession so the USB-detach listener can
  // invoke it without re-registering the listener on every render.
  useEffect(() => {
    stopSessionRef.current = stopSession;
  }, [stopSession]);

  // Handle record button press
  const handleRecordPress = () => {
    if (isFinishingExternalRecording) {
      return;
    }
    if (isSessionActive) {
      void stopSession().catch((error: any) => {
        const friendly = getFriendlyErrorCopy(error, "upload");
        Alert.alert(friendly.title, friendly.message);
      });
      return;
    }
    if (!isExternalReady) {
      Alert.alert("External Camera", externalCamera.statusMessage);
      return;
    }
    startSession();
  };

  // Exit the camera. When it's the stack root (cleaner's home), goBack() is a
  // no-op — fall back to the Locations list instead.
  const exitCamera = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Locations");
    }
  };

  // Handle back/close
  const handleClose = () => {
    if (isSessionActive) {
      Alert.alert(
        "Stop Recording?",
        isGenericRecording
          ? "This will end your session. The recording will stay on the device until you assign a location and task."
          : "This will end your session. All recorded segments are saved locally and will upload automatically.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Stop & Exit",
            style: "destructive",
            onPress: async () => {
              try {
                await stopSession();
                exitCamera();
              } catch (error: any) {
                const friendly = getFriendlyErrorCopy(error, "upload");
                Alert.alert(friendly.title, friendly.message);
              }
            },
          },
        ],
      );
    } else {
      exitCamera();
    }
  };

  const openUploadQueue = () => {
    if (uploadQueue.failed > 0) {
      navigation.navigate("FailedUploads");
      return;
    }
    if (uploadQueue.needsAssignment > 0) {
      navigation.navigate("GenericPendingUploads");
      return;
    }
  };

  useEffect(() => {
    if (!isSessionActive) {
      setShowExternalQueuedConfirmation(false);
    }
  }, [isSessionActive]);

  const externalDisplay = getExternalCameraDisplayState({
    supportState: externalCamera.supportState,
    connectionPhase: externalCamera.connectionPhase,
    sessionState: externalCamera.sessionState,
    statusMessage: externalCamera.statusMessage,
    hasLivePreview: externalCamera.hasLivePreview,
    recordingActive: isSessionActive,
    isModeTransitioning: false,
    isFinishingRecording: isFinishingExternalRecording,
    showQueuedConfirmation: showExternalQueuedConfirmation,
  });

  // Get status message
  const getStatusMessage = (): string => {
    if (externalCamera.isConnectionTimedOut) {
      return "Camera couldn't connect. Try unplugging and reconnecting.";
    }

    if (isSessionActive) {
      return externalDisplay.footerMessage;
    }

    if (uploadQueue.total > 0) {
      if (uploadQueue.failed > 0) {
        return `${uploadQueue.failed} failed • Tap to review`;
      }
      if (uploadQueue.needsAssignment > 0) {
        return `${uploadQueue.needsAssignment} recording${uploadQueue.needsAssignment > 1 ? "s" : ""} need assignment`;
      }
      if (uploadQueue.isUploading) {
        return `Uploading ${uploadQueue.uploading} of ${uploadQueue.total}...`;
      }
      return `${uploadQueue.pending} pending upload${uploadQueue.pending > 1 ? "s" : ""}`;
    }

    return externalDisplay.footerMessage;
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

  // Permission not yet determined
  if (hasCameraPermission === null) {
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
  if (!hasCameraPermission) {
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
          We need camera access to record your session.
        </Text>
        <TouchableOpacity
          onPress={requestCameraPermission}
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

  // No authenticated user — can't record at all.
  if (!user) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="person-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Account Needed</Text>
        <Text style={styles.permissionText}>
          Your account information is missing and the session cannot start.
        </Text>
      </View>
    );
  }

  // Auto mode: resolving the nearest assigned location.
  if (isAutoMode && locationResolveStatus === "resolving") {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={[styles.permissionTitle, { marginTop: 16 }]}>
          Finding your location
        </Text>
        <Text style={styles.permissionText}>
          Matching you to the nearest assigned location…
        </Text>
      </View>
    );
  }

  // Auto mode: location access denied / no GPS fix — camera stays disabled.
  if (isAutoMode && locationResolveStatus === "denied") {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="navigate-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Enable Location</Text>
        <Text style={styles.permissionText}>
          Location access is required to match you to a site. Turn it on to
          start recording.
        </Text>
        <TouchableOpacity
          onPress={resolveNearestLocation}
          style={styles.permissionButton}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Enable Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Locations")}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Choose Manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Auto mode: no nearby assigned location (or none have coordinates).
  if (isAutoMode && locationResolveStatus === "no-match") {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="location-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>No Nearby Location</Text>
        <Text style={styles.permissionText}>
          We couldn't match you to an assigned location. Pick one to start
          recording.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Locations")}
          style={styles.permissionButton}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Choose Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={resolveNearestLocation}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Fallback: a non-generic flow somehow has no location.
  if (!isGenericRecording && !locationId) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <Ionicons name="location-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Pick a Location</Text>
        <Text style={styles.permissionText}>
          Choose a location to start recording.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Locations")}
          style={styles.permissionButton}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Choose Location</Text>
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
              {headerLabel}
            </Text>
          </View>

          {/* Override the auto-bound location — switch sites manually. Hidden
              mid-session so the binding can't change while recording. */}
          {!isSessionActive && !isGenericRecording && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Locations")}
              style={styles.closeButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="list" size={20} color="#fff" />
            </TouchableOpacity>
          )}

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
              onPress={canOpenQueueDetails ? openUploadQueue : undefined}
              style={styles.queueBadge}
              activeOpacity={canOpenQueueDetails ? 0.8 : 1}
              disabled={!canOpenQueueDetails}
            >
              <Text style={styles.queueBadgeText}>{uploadQueue.total}</Text>
            </TouchableOpacity>
          )}
        </HeaderPill>
      </View>

      {/* Bottom floating controls */}
      <View style={[styles.bottomContainer, { bottom: insets.bottom + 30 }]}>
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
            !isExternalReady || isFinishingExternalRecording
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
          onPress={canOpenQueueDetails ? openUploadQueue : undefined}
          activeOpacity={canOpenQueueDetails ? 0.7 : 1}
          disabled={!canOpenQueueDetails}
        >
          {(externalDisplay.showSpinner || uploadQueue.isUploading) && (
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
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
    borderRadius: 28,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    overflow: "hidden",
  },
  headerPillAndroid: {
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  locationContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    marginRight: 8,
  },
  locationIcon: {
    marginRight: 6,
  },
  addressText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#fff",
    flex: 1,
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
  queueBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
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
  statusTextWarning: {
    color: "#FFD60A",
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
