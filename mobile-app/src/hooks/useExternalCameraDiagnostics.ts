import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  ExternalCamera,
  ExternalCameraSessionState,
  ExternalCameraStatus,
  ExternalCameraSupportState,
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
  sessionState: ExternalCameraSessionState | null;
  statusMessage: string;
  attachedUsbVideoDeviceCount: number;
  previewSurfaceAttached: boolean;
  isSupported: boolean;
  isAvailable: boolean;
  canSwitchToExternal: boolean;
  isReady: boolean;
  isSimulated: boolean;
  openSettings: () => void;
  refresh: () => Promise<ExternalCameraStatus | null>;
  ensureExternalCameraSelected: () => Promise<void>;
  waitForSessionState: (
    expectedStates: ExternalCameraSessionState[],
    timeoutMs?: number
  ) => Promise<boolean>;
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
};

const TEMPORARILY_UNAVAILABLE_STATUS: ExternalCameraStatus = {
  ...UNKNOWN_STATUS,
  state: 'temporarily_unavailable',
  message: 'External camera is temporarily unavailable. Reconnect the USB camera and try again.',
};

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
          'USB camera detected, but Android did not expose it as a usable external camera.',
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
        externalCameraCount: 1,
        uvcCameraCount: 0,
        activeCameraId: 'simulated-external-0',
        backend: 'camerax',
        sessionState: 'ready',
        previewSurfaceAttached: true,
      };
    case 'disconnected':
    default:
      return {
        ...UNKNOWN_STATUS,
        state: 'disconnected',
        message: 'Connect an external USB camera to continue.',
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
  const [simulatedState, setSimulatedState] = useState<Exclude<
    ExternalCameraSupportState,
    'unknown'
  > | null>(null);

  const effectiveStatus = simulatedState
    ? createSimulatedStatus(simulatedState)
    : nativeStatus;
  const hasDetectedDevice =
    effectiveStatus.attachedUsbVideoDeviceCount > 0 ||
    effectiveStatus.externalCameraCount > 0 ||
    effectiveStatus.uvcCameraCount > 0;
  const connectionStatus = hasDetectedDevice
    ? 'connected'
    : connectionStatusFromState(effectiveStatus.state);
  const isAvailable =
    effectiveStatus.externalCameraCount > 0 || effectiveStatus.uvcCameraCount > 0;
  const canSwitchToExternal = isSupported;
  const isReady =
    effectiveStatus.state === 'ready' &&
    effectiveStatus.sessionState === 'ready';
  const isSimulated = simulatedState !== null;

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
      return simulatedState ? createSimulatedStatus(simulatedState) : status;
    } catch (error) {
      console.warn('[ExternalCamera] Failed to refresh status', error);
      setNativeStatus((previousStatus) => ({
        ...previousStatus,
        state: 'temporarily_unavailable',
        message: TEMPORARILY_UNAVAILABLE_STATUS.message,
      }));
      return null;
    }
  }, [isSupported, simulatedState]);

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

  const waitForSessionState = useCallback(
    async (
      expectedStates: ExternalCameraSessionState[],
      timeoutMs: number = 1500
    ): Promise<boolean> => {
      if (simulatedState) {
        return expectedStates.includes(createSimulatedStatus(simulatedState).sessionState ?? 'inactive');
      }

      if (!isSupported) {
        return expectedStates.includes('inactive');
      }

      const deadline = Date.now() + timeoutMs;
      while (Date.now() <= deadline) {
        try {
          const status = await ExternalCamera.getStatus();
          setNativeStatus(status);
          const sessionState = status.sessionState ?? 'inactive';
          if (expectedStates.includes(sessionState)) {
            return true;
          }
        } catch (error) {
          console.warn('[ExternalCamera] Failed to poll session state', error);
          return false;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return false;
    },
    [isSupported, simulatedState]
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
    });

    const sessionStateSubscription = ExternalCamera.addSessionStateListener((event) => {
      setNativeStatus((previousStatus) => ({
        ...previousStatus,
        sessionState: event.sessionState ?? previousStatus.sessionState ?? null,
      }));
    });

    const cameraErrorSubscription = ExternalCamera.addCameraErrorListener((event) => {
      if (simulatedState) {
        return;
      }

      setNativeStatus((previousStatus) => ({
        ...previousStatus,
        state: 'temporarily_unavailable',
        message: event.message || TEMPORARILY_UNAVAILABLE_STATUS.message,
      }));
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
    sessionState: effectiveStatus.sessionState ?? null,
    statusMessage: effectiveStatus.message,
    attachedUsbVideoDeviceCount: effectiveStatus.attachedUsbVideoDeviceCount,
    previewSurfaceAttached: effectiveStatus.previewSurfaceAttached === true,
    isSupported,
    isAvailable,
    canSwitchToExternal,
    isReady,
    isSimulated,
    openSettings,
    refresh,
    ensureExternalCameraSelected,
    waitForSessionState,
    simulationControls,
  };
}
