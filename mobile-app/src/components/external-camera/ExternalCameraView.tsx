import React from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { requireNativeComponent } from 'react-native';

type PreviewReadyChangeEvent = NativeSyntheticEvent<{
  ready: boolean;
}>;

type ExternalCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  onPreviewReadyChange?: (event: PreviewReadyChangeEvent) => void;
};

const NativeExternalCameraView =
  Platform.OS === 'android'
    ? requireNativeComponent<ExternalCameraViewProps>('ExternalCameraView')
    : null;

export default function ExternalCameraView({
  style,
  onPreviewReadyChange,
}: ExternalCameraViewProps) {
  if (!NativeExternalCameraView) {
    return <View style={style} />;
  }
  return (
    <NativeExternalCameraView
      style={style}
      onPreviewReadyChange={onPreviewReadyChange}
    />
  );
}
