import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  ExternalCameraConnectionStatus,
  ExternalCameraSimulationControls,
} from '../../hooks/useExternalCameraDiagnostics';
import type {
  ExternalCameraSessionState,
  ExternalCameraSupportState,
} from '../../native/external-camera';

type CameraPermissionStatus = 'unknown' | 'granted' | 'denied';

type ExternalCameraPanelProps = {
  cameraPermissionStatus: CameraPermissionStatus;
  connectionStatus: ExternalCameraConnectionStatus;
  supportState: ExternalCameraSupportState;
  sessionState?: ExternalCameraSessionState | null;
  statusMessage: string;
  usbDeviceDetected: boolean;
  hasLivePreview?: boolean;
  recordingActive?: boolean;
  simulationControls?: ExternalCameraSimulationControls | null;
  onOpenSettings?: () => void;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  preview?: React.ReactNode;
  showPreviewPlaceholder?: boolean;
  showRetryAction?: boolean;
};

type TestStatus = 'pass' | 'fail' | 'pending';

type TestRowProps = {
  title: string;
  status: TestStatus;
  statusLabel: string;
  helperText?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const getStatusMeta = (status: TestStatus) => {
  switch (status) {
    case 'pass':
      return { icon: 'checkmark-circle', color: '#22C55E' };
    case 'fail':
      return { icon: 'close-circle', color: '#EF4444' };
    case 'pending':
    default:
      return { icon: 'time-outline', color: '#F59E0B' };
  }
};

const TestRow = ({
  title,
  status,
  statusLabel,
  helperText,
  actionLabel,
  onAction,
}: TestRowProps) => {
  const meta = getStatusMeta(status);
  const showAction = actionLabel && onAction;

  return (
    <View style={styles.testRow}>
      <View style={styles.testRowMain}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
        <View style={styles.testRowText}>
          <Text style={styles.testTitle}>{title}</Text>
          <Text style={styles.testStatus}>
            {statusLabel}
          </Text>
          {!!helperText && <Text style={styles.testHelper}>{helperText}</Text>}
        </View>
      </View>
      {showAction && (
        <TouchableOpacity style={styles.testAction} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.testActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function ExternalCameraPanel({
  cameraPermissionStatus,
  connectionStatus,
  supportState,
  sessionState,
  statusMessage,
  usbDeviceDetected,
  hasLivePreview = false,
  recordingActive = false,
  simulationControls,
  onOpenSettings,
  onRetry,
  style,
  preview,
  showPreviewPlaceholder = !preview,
  showRetryAction = false,
}: ExternalCameraPanelProps) {
  const permissionStatus: TestStatus =
    cameraPermissionStatus === 'granted'
      ? 'pass'
      : cameraPermissionStatus === 'denied'
      ? 'fail'
      : 'pending';

  const permissionLabel =
    cameraPermissionStatus === 'granted'
      ? 'Granted'
      : cameraPermissionStatus === 'denied'
      ? 'Not granted'
      : 'Checking';
  const permissionHelper =
    cameraPermissionStatus === 'denied'
      ? 'Allow camera access in settings.'
      : undefined;

  const hasActivePreview = hasLivePreview || recordingActive;

  const connectionTestStatus: TestStatus =
    hasActivePreview
      ? 'pass'
      : sessionState === 'error'
      ? 'fail'
      : supportState === 'disconnected' ||
        supportState === 'usb_attached_not_supported' ||
        supportState === 'usb_host_unsupported'
      ? 'fail'
      : supportState === 'ready' ||
        supportState === 'unknown' ||
        supportState === 'camera_permission_required' ||
        supportState === 'usb_permission_required' ||
        supportState === 'temporarily_unavailable'
      ? 'pending'
      : connectionStatus === 'disconnected'
      ? 'fail'
      : 'pending';

  const connectionLabel = (() => {
    if (recordingActive) {
      return 'Recording';
    }

    if (hasLivePreview) {
      return 'Connected';
    }

    switch (supportState) {
      case 'ready':
        switch (sessionState) {
          case 'ready':
            return 'Ready';
          case 'opening':
            return 'Connecting';
          case 'closing':
            return 'Closing';
          case 'inactive':
            return 'Detected';
          case 'error':
            return 'Unavailable';
          default:
            return 'Detected';
        }
      case 'camera_permission_required':
        return 'App permission needed';
      case 'temporarily_unavailable':
        return 'Unavailable';
      case 'usb_permission_required':
        return 'USB permission needed';
      case 'usb_attached_not_supported':
        return 'Unsupported';
      case 'usb_host_unsupported':
        return 'USB host unavailable';
      case 'unknown':
        return 'Checking';
      case 'disconnected':
      default:
        return 'Not detected';
    }
  })();

  const connectionHelperText = recordingActive
    ? 'Recording from the external camera.'
    : hasLivePreview
    ? 'External camera preview is live.'
    : statusMessage;

  const usbTestStatus: TestStatus = usbDeviceDetected ? 'pass' : 'fail';
  const usbLabel = usbDeviceDetected ? 'Detected' : 'Not detected';
  const usbHelper = usbDeviceDetected
    ? undefined
    : 'Attach a USB camera through an OTG adapter to continue.';

  const simulationStates: Array<{
    label: string;
    state: Exclude<ExternalCameraSupportState, 'unknown'>;
    testID: string;
  }> = [
    { label: 'Disconnected', state: 'disconnected', testID: 'external-camera-sim-disconnected' },
    {
      label: 'Camera perm',
      state: 'camera_permission_required',
      testID: 'external-camera-sim-camera-permission',
    },
    {
      label: 'Unavailable',
      state: 'temporarily_unavailable',
      testID: 'external-camera-sim-unavailable',
    },
    {
      label: 'USB perm',
      state: 'usb_permission_required',
      testID: 'external-camera-sim-usb-permission',
    },
    {
      label: 'Unsupported',
      state: 'usb_attached_not_supported',
      testID: 'external-camera-sim-unsupported',
    },
    { label: 'Ready', state: 'ready', testID: 'external-camera-sim-ready' },
  ];

  const showSettingsAction =
    cameraPermissionStatus === 'denied' && onOpenSettings;

  return (
    <View style={[styles.container, style]} testID="external-camera-panel">
      <View style={styles.previewContainer} testID="external-camera-preview">
        {preview}
        {showPreviewPlaceholder && (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="camera-outline" size={44} color="rgba(255,255,255,0.6)" />
            <Text style={styles.previewTitle}>External camera</Text>
            <Text style={styles.previewSubtitle}>Preview will appear here</Text>
          </View>
        )}
      </View>

      <View style={styles.testsCard}>
        <Text style={styles.testsTitle}>External camera checks</Text>
        <TestRow
          title="Camera permission"
          status={permissionStatus}
          statusLabel={permissionLabel}
          helperText={permissionHelper}
          actionLabel={showSettingsAction ? 'Open settings' : undefined}
          onAction={showSettingsAction ? onOpenSettings : undefined}
        />
        <TestRow
          title="USB video device"
          status={usbTestStatus}
          statusLabel={usbLabel}
          helperText={usbHelper}
        />
        <TestRow
          title="External camera detected"
          status={connectionTestStatus}
          statusLabel={connectionLabel}
          helperText={connectionHelperText}
          actionLabel={showRetryAction ? 'Retry' : undefined}
          onAction={showRetryAction ? onRetry : undefined}
        />
      </View>

      {simulationControls && (
        <View style={styles.simulationCard} testID="external-camera-simulation-card">
          <Text style={styles.simulationTitle}>Debug simulation</Text>
          <View style={styles.simulationButtons}>
            {simulationStates.map((item) => {
              const active = simulationControls.currentState === item.state;
              return (
                <TouchableOpacity
                  key={item.state}
                  style={[styles.simulationButton, active && styles.simulationButtonActive]}
                  onPress={() => simulationControls.setState(item.state)}
                  activeOpacity={0.8}
                  testID={item.testID}
                >
                  <Text
                    style={[
                      styles.simulationButtonText,
                      active && styles.simulationButtonTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.simulationButton}
              onPress={simulationControls.clear}
              activeOpacity={0.8}
              testID="external-camera-sim-live"
            >
              <Text style={styles.simulationButtonText}>Live device</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 18,
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  previewSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  testsCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  testsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  testRowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  testRowText: {
    flex: 1,
  },
  testTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  testStatus: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  testHelper: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  testAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  testActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  simulationCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  simulationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  simulationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  simulationButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  simulationButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  simulationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  simulationButtonTextActive: {
    color: '#fff',
  },
});
