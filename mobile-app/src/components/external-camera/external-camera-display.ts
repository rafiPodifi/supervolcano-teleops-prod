import type {
  ExternalCameraConnectionPhase,
  ExternalCameraSessionState,
  ExternalCameraSupportState,
} from '@/native/external-camera';

export type ExternalCameraTestStatus = 'pass' | 'fail' | 'pending';

type ExternalCameraDisplayStateInput = {
  supportState: ExternalCameraSupportState;
  connectionPhase: ExternalCameraConnectionPhase | null;
  sessionState: ExternalCameraSessionState | null;
  statusMessage: string;
  hasLivePreview: boolean;
  recordingActive: boolean;
  isModeTransitioning: boolean;
  isFinishingRecording?: boolean;
  showQueuedConfirmation?: boolean;
};

export type ExternalCameraDisplayState = {
  connectionTestStatus: ExternalCameraTestStatus;
  connectionLabel: string;
  connectionHelperText: string;
  footerMessage: string;
  showSpinner: boolean;
  showRetryAction: boolean;
  showPreviewPlaceholder: boolean;
};

function isDisconnectedState(state: ExternalCameraSupportState): boolean {
  return (
    state === 'disconnected' ||
    state === 'usb_attached_not_supported' ||
    state === 'usb_host_unsupported'
  );
}

function isPermissionState(state: ExternalCameraSupportState): boolean {
  return (
    state === 'camera_permission_required' || state === 'usb_permission_required'
  );
}

function openingLabel(
  phase: ExternalCameraConnectionPhase | null,
  state: ExternalCameraSupportState
): string {
  if (state === 'unknown') {
    return 'Checking';
  }

  if (
    phase === 'preview_opening' ||
    phase === 'awaiting_preview_surface' ||
    phase === 'uvc_connected'
  ) {
    return 'Connecting';
  }

  return 'Preparing';
}

export function getExternalCameraDisplayState({
  supportState,
  connectionPhase,
  sessionState,
  statusMessage,
  hasLivePreview,
  recordingActive,
  isModeTransitioning,
  isFinishingRecording = false,
  showQueuedConfirmation = false,
}: ExternalCameraDisplayStateInput): ExternalCameraDisplayState {
  const hasActivePreview = hasLivePreview || recordingActive;
  const hasStableError =
    connectionPhase === 'error' || sessionState === 'error';
  const disconnected = isDisconnectedState(supportState);
  const permissionRequired = isPermissionState(supportState);
  const isOpening =
    !hasActivePreview &&
    !isModeTransitioning &&
    !isFinishingRecording &&
    !showQueuedConfirmation &&
    !hasStableError &&
    !disconnected &&
    !permissionRequired;

  const footerMessage = (() => {
    if (isModeTransitioning) {
      return 'Switching camera...';
    }
    if (isFinishingRecording) {
      return 'Finishing external recording and saving it to the upload queue...';
    }
    if (showQueuedConfirmation) {
      return 'Saved to upload queue.';
    }
    if (recordingActive) {
      return 'Recording from external camera...';
    }
    if (hasLivePreview) {
      return 'External camera preview is live.';
    }
    return statusMessage;
  })();

  const connectionLabel = (() => {
    if (isModeTransitioning) {
      return 'Switching';
    }
    if (isFinishingRecording) {
      return 'Finishing';
    }
    if (recordingActive) {
      return 'Recording';
    }
    if (hasLivePreview) {
      return 'Connected';
    }
    if (hasStableError) {
      return 'Unavailable';
    }
    if (supportState === 'camera_permission_required') {
      return 'App permission needed';
    }
    if (supportState === 'usb_permission_required') {
      return 'USB permission needed';
    }
    if (supportState === 'usb_attached_not_supported') {
      return 'Unsupported';
    }
    if (supportState === 'usb_host_unsupported') {
      return 'USB host unavailable';
    }
    if (supportState === 'disconnected') {
      return 'Not detected';
    }
    if (showQueuedConfirmation && !hasLivePreview) {
      return 'Queued';
    }
    if (isOpening) {
      return openingLabel(connectionPhase, supportState);
    }
    return 'Checking';
  })();

  const connectionTestStatus: ExternalCameraTestStatus =
    hasActivePreview || showQueuedConfirmation
      ? 'pass'
      : hasStableError || disconnected
      ? 'fail'
      : 'pending';

  return {
    connectionTestStatus,
    connectionLabel,
    connectionHelperText: footerMessage,
    footerMessage,
    showSpinner: isModeTransitioning || isFinishingRecording || isOpening,
    showRetryAction: hasStableError && !hasActivePreview && !isFinishingRecording,
    showPreviewPlaceholder: !hasActivePreview,
  };
}
