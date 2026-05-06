package com.supervolcano.externalcamera

import android.os.Bundle

enum class SupportState(val raw: String) {
  Unknown("unknown"),
  Disconnected("disconnected"),
  TemporarilyUnavailable("temporarily_unavailable"),
  CameraPermissionRequired("camera_permission_required"),
  UsbPermissionRequired("usb_permission_required"),
  UsbAttachedNotSupported("usb_attached_not_supported"),
  UsbHostUnsupported("usb_host_unsupported"),
  Ready("ready"),
}

enum class ConnectionPhase(val raw: String) {
  Detected("detected"),
  AwaitingAndroidPermission("awaiting_android_permission"),
  AndroidPermissionGranted("android_permission_granted"),
  UvcConnecting("uvc_connecting"),
  UvcConnected("uvc_connected"),
  AwaitingPreviewSurface("awaiting_preview_surface"),
  PreviewOpening("preview_opening"),
  Ready("ready"),
  Recording("recording"),
  Error("error"),
}

enum class SessionState(val raw: String) {
  Inactive("inactive"),
  Opening("opening"),
  Ready("ready"),
  Closing("closing"),
  Error("error"),
}

data class SelectedProfile(
  val width: Int,
  val height: Int,
  val format: String,
)

data class AttemptedProfile(
  val profile: SelectedProfile,
  val result: String,
  val failureReason: String? = null,
  val attemptIndex: Int = 0,
)

data class OfferedFormat(
  val width: Int,
  val height: Int,
  val format: String,
  val maxFps: Int,
  val fpsList: List<Int>,
)

data class ExternalCameraStatusSnapshot(
  val supportState: SupportState = SupportState.Unknown,
  val message: String = "Checking external camera...",
  val hasUsbHostFeature: Boolean = true,
  val hasCameraPermission: Boolean = true,
  val attachedUsbVideoDeviceCount: Int = 0,
  val usbPermissionCount: Int = 0,
  val externalCameraCount: Int = 0,
  val uvcCameraCount: Int = 0,
  val activeCameraId: String? = null,
  val backend: String? = null,
  val connectionPhase: ConnectionPhase? = null,
  val externalModeEnabled: Boolean = false,
  val sessionState: SessionState? = null,
  val previewSurfaceAttached: Boolean = false,
  val deviceKey: String? = null,
  val selectedProfile: SelectedProfile? = null,
  val attemptedProfiles: List<AttemptedProfile> = emptyList(),
  val deviceOffered: List<OfferedFormat> = emptyList(),
  val lastFailureReason: String? = null,
  val compatibilityMode: String? = null,
) {
  fun toBundle(): Bundle = Bundle().apply {
    putString("state", supportState.raw)
    putString("message", message)
    putBoolean("hasUsbHostFeature", hasUsbHostFeature)
    putBoolean("hasCameraPermission", hasCameraPermission)
    putInt("attachedUsbVideoDeviceCount", attachedUsbVideoDeviceCount)
    putInt("usbPermissionCount", usbPermissionCount)
    putInt("externalCameraCount", externalCameraCount)
    putInt("uvcCameraCount", uvcCameraCount)
    putString("activeCameraId", activeCameraId)
    putString("backend", backend)
    putString("connectionPhase", connectionPhase?.raw)
    putBoolean("externalModeEnabled", externalModeEnabled)
    putString("sessionState", sessionState?.raw)
    putBoolean("previewSurfaceAttached", previewSurfaceAttached)
    putString("deviceKey", deviceKey)
    selectedProfile?.let {
      putBundle("selectedProfile", Bundle().apply {
        putInt("width", it.width)
        putInt("height", it.height)
        putString("format", it.format)
      })
    }
    val attempts = attemptedProfiles.map { attempt ->
      Bundle().apply {
        putBundle("profile", Bundle().apply {
          putInt("width", attempt.profile.width)
          putInt("height", attempt.profile.height)
          putString("format", attempt.profile.format)
        })
        putString("result", attempt.result)
        putString("failureReason", attempt.failureReason)
        putInt("attemptIndex", attempt.attemptIndex)
      }
    }
    putParcelableArrayList("attemptedProfiles", ArrayList(attempts))
    val offered = deviceOffered.map { o ->
      Bundle().apply {
        putInt("width", o.width)
        putInt("height", o.height)
        putString("format", o.format)
        putInt("maxFps", o.maxFps)
        putIntegerArrayList("fpsList", ArrayList(o.fpsList))
      }
    }
    putParcelableArrayList("deviceOffered", ArrayList(offered))
    putString("lastFailureReason", lastFailureReason)
    putString("compatibilityMode", compatibilityMode)
  }
}
