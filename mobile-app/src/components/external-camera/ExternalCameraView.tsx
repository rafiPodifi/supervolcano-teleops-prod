import React from "react";
import {
  NativeSyntheticEvent,
  Platform,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

type PreviewReadyChangeEvent = NativeSyntheticEvent<{
  ready: boolean;
}>;

type ExternalCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  onPreviewReadyChange?: (event: PreviewReadyChangeEvent) => void;
};

const NativeExternalCameraView =
  Platform.OS === "android"
    ? requireNativeViewManager<ExternalCameraViewProps>("ExternalCameraModule")
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
