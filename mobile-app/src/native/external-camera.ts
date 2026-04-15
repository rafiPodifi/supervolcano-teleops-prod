import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export type ExternalCameraFacing = 'front' | 'back' | 'external' | 'unknown';
export type ExternalCameraSessionState =
  | 'inactive'
  | 'opening'
  | 'ready'
  | 'closing'
  | 'error';

export type ExternalCameraConnectionPhase =
  | 'detected'
  | 'awaiting_android_permission'
  | 'android_permission_granted'
  | 'uvc_connecting'
  | 'uvc_connected'
  | 'awaiting_preview_surface'
  | 'preview_opening'
  | 'ready'
  | 'recording'
  | 'error';

export type ExternalCameraInfo = {
  id: string;
  facing: ExternalCameraFacing;
};

export type ExternalCameraSupportState =
  | 'unknown'
  | 'disconnected'
  | 'temporarily_unavailable'
  | 'camera_permission_required'
  | 'usb_permission_required'
  | 'usb_attached_not_supported'
  | 'usb_host_unsupported'
  | 'ready';

export type ExternalCameraStatus = {
  state: ExternalCameraSupportState;
  message: string;
  hasUsbHostFeature: boolean;
  hasCameraPermission: boolean;
  attachedUsbVideoDeviceCount: number;
  usbPermissionCount: number;
  externalCameraCount: number;
  uvcCameraCount: number;
  activeCameraId?: string | null;
  backend?: 'camerax' | 'uvc' | null;
  connectionPhase?: ExternalCameraConnectionPhase | null;
  externalModeEnabled?: boolean;
  sessionState?: ExternalCameraSessionState | null;
  previewSurfaceAttached?: boolean;
  deviceKey?: string | null;
  selectedProfile?: {
    width: number;
    height: number;
    format: 'mjpeg' | 'yuyv';
  } | null;
  attemptedProfiles?: Array<{
    profile: {
      width: number;
      height: number;
      format: 'mjpeg' | 'yuyv';
    };
    result: 'success' | 'failed';
    failureReason?: string | null;
  }>;
  lastFailureReason?: string | null;
  compatibilityMode?: 'legacy_fixed' | 'adaptive' | null;
};

export type RecordingStateEvent = {
  state: 'started' | 'finalized' | 'error';
  filePath?: string;
  message?: string;
};

export type CameraErrorEvent = {
  message?: string;
};

export type ExternalCameraSessionEvent = {
  sessionState?: ExternalCameraSessionState | null;
};

type CameraAvailabilityEvent = {
  hasExternal: boolean;
  cameras?: ExternalCameraInfo[];
};

export type UsbCameraEvent = {
  vendorId?: number;
  productId?: number;
  deviceName?: string;
  hasPermission?: boolean;
};

export type UsbPermissionEvent = {
  vendorId?: number;
  productId?: number;
  deviceName?: string;
  granted: boolean;
};

type StartRecordingOptions = {
  enableAudio?: boolean;
  quality?: 'highest' | 'fhd' | 'hd' | 'sd';
};

const NativeExternalCameraModule = NativeModules.ExternalCameraModule;
const eventEmitter = NativeExternalCameraModule
  ? new NativeEventEmitter(NativeExternalCameraModule)
  : null;

export const ExternalCamera = {
  isSupported: Platform.OS === 'android' && !!NativeExternalCameraModule,

  async getAvailableCameras(): Promise<ExternalCameraInfo[]> {
    if (!NativeExternalCameraModule) {
      return [];
    }
    return NativeExternalCameraModule.getAvailableCameras();
  },

  async getStatus(): Promise<ExternalCameraStatus> {
    if (!NativeExternalCameraModule) {
      return {
        state: 'disconnected',
        message: 'External cameras are only supported on Android.',
        hasUsbHostFeature: false,
        hasCameraPermission: false,
        attachedUsbVideoDeviceCount: 0,
        usbPermissionCount: 0,
        externalCameraCount: 0,
        uvcCameraCount: 0,
        activeCameraId: null,
        backend: null,
        connectionPhase: null,
        externalModeEnabled: false,
        sessionState: null,
        previewSurfaceAttached: false,
        deviceKey: null,
        selectedProfile: null,
        attemptedProfiles: [],
        lastFailureReason: null,
        compatibilityMode: null,
      };
    }
    return NativeExternalCameraModule.getStatus();
  },

  async setActiveCamera(cameraId: string): Promise<void> {
    if (!NativeExternalCameraModule) {
      return;
    }
    await NativeExternalCameraModule.setActiveCamera(cameraId);
  },

  async setExternalModeEnabled(enabled: boolean): Promise<void> {
    if (!NativeExternalCameraModule) {
      return;
    }
    await NativeExternalCameraModule.setExternalModeEnabled(enabled);
  },

  async startRecording(outputPath: string, options?: StartRecordingOptions): Promise<void> {
    if (!NativeExternalCameraModule) {
      return;
    }
    await NativeExternalCameraModule.startRecording(outputPath, options ?? {});
  },

  async stopRecording(): Promise<void> {
    if (!NativeExternalCameraModule) {
      return;
    }
    await NativeExternalCameraModule.stopRecording();
  },

  async retryPreview(): Promise<void> {
    if (!NativeExternalCameraModule) {
      return;
    }
    await NativeExternalCameraModule.retryPreview();
  },

  addCameraAvailabilityListener(
    listener: (event: CameraAvailabilityEvent) => void
  ) {
    return eventEmitter?.addListener('onCameraAvailabilityChanged', listener);
  },

  addRecordingStateListener(
    listener: (event: RecordingStateEvent) => void
  ) {
    return eventEmitter?.addListener('onRecordingStateChanged', listener);
  },

  addCameraErrorListener(
    listener: (event: CameraErrorEvent) => void
  ) {
    return eventEmitter?.addListener('onCameraError', listener);
  },

  addSessionStateListener(
    listener: (event: ExternalCameraSessionEvent) => void
  ) {
    return eventEmitter?.addListener('onExternalCameraSessionStateChanged', listener);
  },

  addUsbAttachListener(
    listener: (event: UsbCameraEvent) => void
  ) {
    return eventEmitter?.addListener('onUsbAttached', listener);
  },

  addUsbDetachListener(
    listener: (event: UsbCameraEvent) => void
  ) {
    return eventEmitter?.addListener('onUsbDetached', listener);
  },

  addUsbPermissionListener(
    listener: (event: UsbPermissionEvent) => void
  ) {
    return eventEmitter?.addListener('onUsbPermissionResult', listener);
  },

  addStatusListener(
    listener: (event: ExternalCameraStatus) => void
  ) {
    return eventEmitter?.addListener('onExternalCameraStatusChanged', listener);
  },
};
