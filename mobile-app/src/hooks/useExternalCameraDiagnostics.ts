import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  ExternalCamera,
  ExternalCameraConnectionPhase,
  ExternalCameraSessionState,
  ExternalCameraStatus,
  ExternalCameraSupportState,
  profileToQuality,
} from '@/native/external-camera';

export type ExternalCameraConnectionStatus = 'unknown' | 'connected' | 'disconnected';

export type ExternalCameraSimulationControls = {
  currentState: ExternalCameraSupportState | null;
  clear: () => void;
  setState: (state: Exclude<ExternalCameraSupportState, 'unknown'>) => void;
};

export type ExternalCameraDiagnostics = {
  connectionStatus: ExternalCameraConnectionStatus;
  supportState: ExternalCameraSupportState;
  connectionPhase: ExternalCameraConnectionPhase | null;
  sessionState: ExternalCameraSessionState | null;
  statusMessage: string;
  hasLivePreview: boolean;
  attachedUsbVideoDeviceCount: number;
  previewSurfaceAttached: boolean;
  isSupported: boolean;
  isAvailable: boolean;
  canSwitchToExternal: boolean;
  isReady: boolean;
  isSimulated: boolean;
  openSettings: () => void;
  refresh: () => Promise<ExternalCameraStatus | null>;
  retryPreview: () => Promise<void>;
  ensureExternalCameraSelected: () => Promise<void>;
  waitForSessionState: (
    expectedStates: ExternalCameraSessionState[],
    timeoutMs?: number
  ) => Promise<boolean>;
  isConnectionTimedOut: boolean;
  resetConnectionTimeout: () => void;
  selectedProfile: ExternalCameraStatus['selectedProfile'];
  negotiatedQuality: 'fhd' | 'hd' | 'sd' | null;
  simulationControls: ExternalCameraSimulationControls | null;
};

const UNKNOWN_STATUS: ExternalCameraStatus = {
  state: 'unknown',
  message: 'Checking external camera...',
  hasUsbHostFeature: true,
  hasCameraPermission: true,
  attachedUsbVideoDeviceCount: 0,
  usbPermissionCount: 0,
  externalCameraCount: 0,
  uvcCameraCount: 0,
  activeCameraId: null,
  backend: null,
  sessionState: null,
  previewSurfaceAttached: false,
  connectionPhase: null,
};

const TEMPORARILY_UNAVAILABLE_STATUS: ExternalCameraStatus = {
  ...UNKNOWN_STATUS,
  state: 'temporarily_unavailable',
  message: 'External camera is temporarily unavailable. Reconnect the USB camera and try again.',
};

function hasNativeLivePreview(status: ExternalCameraStatus): boolean {
  return (
    status.state === 'ready' ||
    status.sessionState === 'ready' ||
    status.connectionPhase === 'ready' ||
    status.connectionPhase === 'recording'
  );
}

function connectionStatusFromState(
  state: ExternalCameraSupportState
): ExternalCameraConnectionStatus {
  if (state === 'ready') {
    return 'connected';
  }
  if (state === 'unknown') {
    return 'unknown';
  }
  return 'disconnected';
}

function createSimulatedStatus(
  state: Exclude<ExternalCameraSupportState, 'unknown'>
): ExternalCameraStatus {
  switch (state) {
    case 'camera_permission_required':
      return {
        ...UNKNOWN_STATUS,
        state,
        message: 'Allow camera access to use an external camera.',
        hasCameraPermission: false,
      };
    case 'temporarily_unavailable':
      return {
        ...TEMPORARILY_UNAVAILABLE_STATUS,
      };
    case 'usb_permission_required':
      return {
        ...UNKNOWN_STATUS,
        state,
        message: 'Grant access to the USB camera in the system prompt.',
        attachedUsbVideoDeviceCount: 1,
      };
    case 'usb_attached_not_supported':
      return {
        ...UNKNOWN_STATUS,
        state,
        message:
          'USB camera detected, but no usable UVC camera is ready yet.',
        attachedUsbVideoDeviceCount: 1,
        usbPermissionCount: 1,
      };
    case 'usb_host_unsupported':
      return {
        ...UNKNOWN_STATUS,
        state,
        message: 'This device does not support USB host mode.',
        hasUsbHostFeature: false,
      };
    case 'ready':
      return {
        ...UNKNOWN_STATUS,
        state,
        message: 'External camera ready.',
        attachedUsbVideoDeviceCount: 1,
        usbPermissionCount: 1,
        externalCameraCount: 0,
        uvcCameraCount: 1,
        activeCameraId: 'uvc:27',
        backend: 'uvc',
        connectionPhase: 'ready',
        sessionState: 'ready',
        previewSurfaceAttached: true,
      };
    case 'disconnected':
    default:
      return {
        ...UNKNOWN_STATUS,
        state: 'disconnected',
        message: 'Connect an external USB camera to continue.',
        connectionPhase: null,
        sessionState: 'inactive',
        previewSurfaceAttached: false,
      };
  }
}

export function useExternalCameraDiagnostics(): ExternalCameraDiagnostics {
  const isSupported = ExternalCamera.isSupported;
  const [nativeStatus, setNativeStatus] = useState<ExternalCameraStatus>(
    isSupported
      ? UNKNOWN_STATUS
      : {
          ...UNKNOWN_STATUS,
          state: 'disconnected',
          message: 'External cameras are only supported on Android.',
        }
  );
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [isConnectionTimedOut, setIsConnectionTimedOut] = useState(false);
  const [simulatedState, setSimulatedState] = useState<Exclude<
    ExternalCameraSupportState,
    'unknown'
  > | null>(null);

  const effectiveStatus = simulatedState
    ? createSimulatedStatus(simulatedState)
    : nativeStatus;
  const hasLivePreview = hasNativeLivePreview(effectiveStatus);
  const hasDetectedDevice =
    effectiveStatus.attachedUsbVideoDeviceCount > 0 ||
    effectiveStatus.externalCameraCount > 0 ||
    effectiveStatus.uvcCameraCount > 0;
  const connectionStatus = hasDetectedDevice
    ? 'connected'
    : connectionStatusFromState(effectiveStatus.state);
  const isAvailable = hasDetectedDevice;
  const canSwitchToExternal = isSupported;
  const isReady =
    effectiveStatus.state === 'ready' &&
    effectiveStatus.sessionState === 'ready';
  const isSimulated = simulatedState !== null;
  const negotiatedQuality = effectiveStatus.selectedProfile
    ? profileToQuality(effectiveStatus.selectedProfile)
    : null;
  const statusMessage = hasLivePreview
    ? 'External camera preview is live.'
    : cameraErrorMessage ?? effectiveStatus.message;

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const refresh = useCallback(async (): Promise<ExternalCameraStatus | null> => {
    if (!isSupported) {
      return null;
    }

    try {
      const status = await ExternalCamera.getStatus();
      setNativeStatus(status);
      if (hasNativeLivePreview(status) || status.state !== 'temporarily_unavailable') {
        setCameraErrorMessage(null);
      }
      return simulatedState ? createSimulatedStatus(simulatedState) : status;
    } catch (error) {
      console.warn('[ExternalCamera] Failed to refresh status', error);
      setNativeStatus((previousStatus) => ({
        ...previousStatus,
        state: 'temporarily_unavailable',
        message: TEMPORARILY_UNAVAILABLE_STATUS.message,
      }));
      setCameraErrorMessage(TEMPORARILY_UNAVAILABLE_STATUS.message);
      return null;
    }
  }, [isSupported, simulatedState]);

  const retryPreview = useCallback(async () => {
    if (!isSupported || simulatedState) {
      return;
    }

    await ExternalCamera.retryPreview();
    await refresh();
  }, [isSupported, refresh, simulatedState]);

  const ensureExternalCameraSelected = useCallback(async () => {
    if (!isSupported || simulatedState) {
      return;
    }

    const cameras = await ExternalCamera.getAvailableCameras();
    const externalCamera = cameras.find((camera) => camera.facing === 'external');
    if (externalCamera) {
      await ExternalCamera.setActiveCamera(externalCamera.id);
    }
  }, [isSupported, simulatedState]);

  const resetConnectionTimeout = useCallback(() => {
    setIsConnectionTimedOut(false);
  }, []);

  const waitForSessionState = useCallback(
    (
      expectedStates: ExternalCameraSessionState[],
      timeoutMs: number = 1500
    ): Promise<boolean> => {
      if (simulatedState) {
        return Promise.resolve(
          expectedStates.includes(createSimulatedStatus(simulatedState).sessionState ?? 'inactive')
        );
      }

      if (!isSupported) {
        return Promise.resolve(expectedStates.includes('inactive'));
      }

      // Check current state first — may already be satisfied
      const current = nativeStatus.sessionState ?? 'inactive';
      if (expectedStates.includes(current)) {
        return Promise.resolve(true);
      }

      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          cleanup();
          setIsConnectionTimedOut(true);
          resolve(false);
        }, timeoutMs);

        const sub = ExternalCamera.addSessionStateListener((event) => {
          const state = event.sessionState ?? 'inactive';
          if (expectedStates.includes(state)) {
            cleanup();
            setIsConnectionTimedOut(false);
            resolve(true);
          }
        });

        function cleanup() {
          clearTimeout(timer);
          sub?.remove();
        }
      });
    },
    [isSupported, simulatedState, nativeStatus]
  );

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const attachSubscription = ExternalCamera.addUsbAttachListener((event) => {
      if (event.hasPermission === true || event.hasPermission === false) {
        refresh();
      }
    });

    const detachSubscription = ExternalCamera.addUsbDetachListener(() => {
      if (!simulatedState) {
        refresh().catch((error) => {
          console.warn('[ExternalCamera] Refresh after detach failed', error);
        });
      }
    });

    const permissionSubscription = ExternalCamera.addUsbPermissionListener((event) => {
      if (!event.granted) {
        Alert.alert(
          'USB permission denied',
          'Allow access to the USB camera to use external recording.'
        );
      }

      if (!simulatedState) {
        refresh().catch((error) => {
          console.warn('[ExternalCamera] Refresh after USB permission update failed', error);
        });
      }
    });

    return () => {
      attachSubscription?.remove();
      detachSubscription?.remove();
      permissionSubscription?.remove();
    };
  }, [isSupported, refresh, simulatedState]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    refresh();

    const subscription = ExternalCamera.addCameraAvailabilityListener((event) => {
      if (simulatedState) {
        return;
      }

      refresh().catch((error) => {
        console.warn('[ExternalCamera] Refresh after availability change failed', error);
      });
    });

    const statusSubscription = ExternalCamera.addStatusListener((status) => {
      setNativeStatus(status);
      if (hasNativeLivePreview(status) || status.state !== 'temporarily_unavailable') {
        setCameraErrorMessage(null);
      }
      if (status.state === 'ready') {
        setIsConnectionTimedOut(false);
      }
    });

    const sessionStateSubscription = ExternalCamera.addSessionStateListener((event) => {
      setNativeStatus((previousStatus) => ({
        ...previousStatus,
        sessionState: event.sessionState ?? previousStatus.sessionState ?? null,
      }));

      if (event.sessionState === 'ready') {
        setCameraErrorMessage(null);
      }
    });

    const cameraErrorSubscription = ExternalCamera.addCameraErrorListener((event) => {
      if (simulatedState) {
        return;
      }

      setCameraErrorMessage(event.message || TEMPORARILY_UNAVAILABLE_STATUS.message);
    });

    return () => {
      subscription?.remove();
      statusSubscription?.remove();
      sessionStateSubscription?.remove();
      cameraErrorSubscription?.remove();
    };
  }, [isSupported, refresh, simulatedState]);

  const simulationControls =
    __DEV__ && isSupported
      ? {
          currentState: simulatedState,
          clear: () => setSimulatedState(null),
          setState: (state: Exclude<ExternalCameraSupportState, 'unknown'>) =>
            setSimulatedState(state),
        }
      : null;

  return {
    connectionStatus,
    supportState: effectiveStatus.state,
    connectionPhase: effectiveStatus.connectionPhase ?? null,
    sessionState: effectiveStatus.sessionState ?? null,
    statusMessage,
    hasLivePreview,
    attachedUsbVideoDeviceCount: effectiveStatus.attachedUsbVideoDeviceCount,
    previewSurfaceAttached: effectiveStatus.previewSurfaceAttached === true,
    isSupported,
    isAvailable,
    canSwitchToExternal,
    isReady,
    isSimulated,
    isConnectionTimedOut,
    selectedProfile: effectiveStatus.selectedProfile ?? null,
    negotiatedQuality,
    openSettings,
    refresh,
    retryPreview,
    ensureExternalCameraSelected,
    resetConnectionTimeout,
    waitForSessionState,
    simulationControls,
  };
}
