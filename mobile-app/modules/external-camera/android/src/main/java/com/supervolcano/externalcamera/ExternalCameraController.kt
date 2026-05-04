package com.supervolcano.externalcamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.usb.UsbDevice
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import androidx.core.content.ContextCompat
import com.supervolcano.externalcamera.backend.UvcBackend
import java.lang.ref.WeakReference

class ExternalCameraController private constructor(
  appContext: Context,
) : UsbDeviceMonitor.Listener, UvcBackend.Listener {

  fun interface EventSink {
    fun emit(name: String, payload: Map<String, Any?>)
  }

  private val context: Context = appContext.applicationContext
  private val mainHandler = Handler(Looper.getMainLooper())
  private val usbMonitor = UsbDeviceMonitor(context, this)
  private val backend = UvcBackend(context, this)
  private var sink: EventSink? = null
  private var previewView: WeakReference<ExternalCameraPreviewView>? = null
  private var pendingPreviewSurface: Surface? = null

  @Volatile
  private var status: ExternalCameraStatusSnapshot = initialStatus()
  @Volatile
  private var externalModeEnabled: Boolean = false

  fun start(sink: EventSink) {
    this.sink = sink
    usbMonitor.start()
    mainHandler.post { backend.init() }
    refreshStatus(emit = true)
  }

  fun stop() {
    usbMonitor.stop()
    mainHandler.post { backend.release() }
    sink = null
  }

  fun attachPreviewView(view: ExternalCameraPreviewView) {
    previewView = WeakReference(view)
    updateStatus { it.copy(previewSurfaceAttached = true) }
  }

  fun detachPreviewView(view: ExternalCameraPreviewView) {
    if (previewView?.get() === view) {
      previewView = null
      updateStatus { it.copy(previewSurfaceAttached = false) }
    }
  }

  fun onPreviewSurfaceCreated(view: ExternalCameraPreviewView, surface: Surface) {
    if (previewView?.get() !== view) return
    pendingPreviewSurface = surface
    mainHandler.post { backend.attachSurface(surface) }
    if (status.connectionPhase == null || status.connectionPhase == ConnectionPhase.UvcConnected) {
      updateStatus { it.copy(connectionPhase = ConnectionPhase.PreviewOpening) }
    }
  }

  fun onPreviewSurfaceDestroyed(view: ExternalCameraPreviewView, surface: Surface) {
    if (pendingPreviewSurface === surface) pendingPreviewSurface = null
    mainHandler.post { backend.detachSurface(surface) }
    if (previewView?.get() === view) {
      updateStatus {
        it.copy(
          previewSurfaceAttached = false,
          sessionState = if (it.sessionState == SessionState.Ready) SessionState.Closing else it.sessionState,
        )
      }
    }
  }

  fun getStatus(): ExternalCameraStatusSnapshot {
    refreshStatus(emit = false)
    return status
  }

  fun listAvailableCameras(): List<Pair<String, String>> {
    val devices = usbMonitor.listAttachedVideoDevices()
    return devices.map { device -> "uvc:${device.deviceId}" to "external" }
  }

  fun setActiveCamera(cameraId: String) {
    updateStatus { it.copy(activeCameraId = cameraId) }
  }

  fun setExternalModeEnabled(enabled: Boolean) {
    externalModeEnabled = enabled
    updateStatus { it.copy(externalModeEnabled = enabled) }
    if (enabled) {
      tryConnect()
    } else {
      mainHandler.post { backend.closeCamera() }
      updateStatus {
        it.copy(
          connectionPhase = null,
          sessionState = SessionState.Inactive,
        )
      }
    }
  }

  fun retryPreview() {
    tryConnect()
  }

  fun startRecording(@Suppress("UNUSED_PARAMETER") outputPath: String) {
    sink?.emit("onRecordingStateChanged", mapOf(
      "state" to "error",
      "message" to "Recording not yet implemented (Phase 3)."
    ))
  }

  fun stopRecording() {
    sink?.emit("onRecordingStateChanged", mapOf("state" to "finalized"))
  }

  override fun onUsbAttached(device: UsbDevice, hasPermission: Boolean) {
    sink?.emit("onUsbAttached", mapOf(
      "vendorId" to device.vendorId,
      "productId" to device.productId,
      "deviceName" to device.deviceName,
      "hasPermission" to hasPermission,
    ))
    refreshStatus(emit = true)
  }

  override fun onUsbDetached(device: UsbDevice) {
    sink?.emit("onUsbDetached", mapOf(
      "vendorId" to device.vendorId,
      "productId" to device.productId,
      "deviceName" to device.deviceName,
    ))
    refreshStatus(emit = true)
  }

  override fun onUsbPermissionResult(device: UsbDevice?, granted: Boolean) {
    sink?.emit("onUsbPermissionResult", mapOf(
      "vendorId" to (device?.vendorId ?: -1),
      "productId" to (device?.productId ?: -1),
      "deviceName" to (device?.deviceName ?: ""),
      "granted" to granted,
    ))
    refreshStatus(emit = true)
  }

  override fun onBackendConnecting() {
    updateStatus {
      it.copy(
        connectionPhase = ConnectionPhase.UvcConnecting,
        sessionState = SessionState.Opening,
        backend = "uvc",
      )
    }
  }

  override fun onBackendConnected(
    profile: SelectedProfile,
    attempted: List<AttemptedProfile>,
    offered: List<OfferedFormat>,
    attemptIndex: Int,
  ) {
    val deviceKey = "uvc:${System.currentTimeMillis()}"
    val mode = if (attemptIndex == 0) "adaptive" else "legacy_fixed"
    Log.d(TAG, "onBackendConnected ${profile.width}x${profile.height} ${profile.format} attemptIndex=$attemptIndex mode=$mode")
    updateStatus {
      it.copy(
        connectionPhase = if (pendingPreviewSurface != null)
          ConnectionPhase.PreviewOpening
        else
          ConnectionPhase.AwaitingPreviewSurface,
        sessionState = SessionState.Opening,
        selectedProfile = profile,
        attemptedProfiles = attempted,
        deviceOffered = offered,
        deviceKey = deviceKey,
        uvcCameraCount = 1,
        compatibilityMode = mode,
      )
    }
    previewView?.get()?.applyAspectRatio(profile.width, profile.height)
  }

  override fun onBackendNegotiationFailed(
    reason: String,
    attempted: List<AttemptedProfile>,
    offered: List<OfferedFormat>,
  ) {
    Log.w(TAG, "onBackendNegotiationFailed reason=$reason attempted=${attempted.size} offered=${offered.size}")
    sink?.emit("onCameraError", mapOf("message" to reason))
    updateStatus {
      it.copy(
        supportState = SupportState.TemporarilyUnavailable,
        message = "External camera error.",
        connectionPhase = ConnectionPhase.Error,
        sessionState = SessionState.Error,
        lastFailureReason = reason,
        attemptedProfiles = attempted,
        deviceOffered = offered,
        compatibilityMode = null,
      )
    }
    previewView?.get()?.emitPreviewReady(false)
  }

  override fun onBackendPreviewReady() {
    updateStatus {
      it.copy(
        supportState = SupportState.Ready,
        message = "External camera ready.",
        connectionPhase = ConnectionPhase.Ready,
        sessionState = SessionState.Ready,
      )
    }
    previewView?.get()?.emitPreviewReady(true)
  }

  override fun onBackendError(reason: String) {
    Log.w(TAG, "onBackendError reason=$reason")
    sink?.emit("onCameraError", mapOf("message" to reason))
    updateStatus {
      it.copy(
        supportState = SupportState.TemporarilyUnavailable,
        message = "External camera error.",
        connectionPhase = ConnectionPhase.Error,
        sessionState = SessionState.Error,
        lastFailureReason = reason,
      )
    }
    previewView?.get()?.emitPreviewReady(false)
  }

  override fun onBackendDetached() {
    Log.d(TAG, "onBackendDetached")
    updateStatus {
      it.copy(
        supportState = SupportState.Disconnected,
        message = "Connect an external USB camera to continue.",
        connectionPhase = null,
        sessionState = SessionState.Inactive,
        selectedProfile = null,
        deviceKey = null,
        compatibilityMode = null,
      )
    }
    previewView?.get()?.emitPreviewReady(false)
  }

  private fun tryConnect() {
    val pm = context.packageManager
    if (!pm.hasSystemFeature(PackageManager.FEATURE_USB_HOST)) {
      updateStatus { it.copy(supportState = SupportState.UsbHostUnsupported, message = "This device does not support USB host mode.") }
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      updateStatus { it.copy(supportState = SupportState.CameraPermissionRequired, message = "Allow camera access to use an external camera.") }
      return
    }

    val attached = usbMonitor.listAttachedVideoDevices()
    val device = attached.firstOrNull()
    if (device == null) {
      updateStatus {
        it.copy(
          supportState = SupportState.Disconnected,
          message = "Connect an external USB camera to continue.",
          connectionPhase = null,
          sessionState = SessionState.Inactive,
        )
      }
      return
    }

    if (!usbMonitor.hasPermission(device)) {
      usbMonitor.requestPermission(device)
      updateStatus {
        it.copy(
          supportState = SupportState.UsbPermissionRequired,
          message = "Grant access to the USB camera in the system prompt.",
        )
      }
      return
    }

    mainHandler.post { backend.connect(device) }
  }

  private fun refreshStatus(emit: Boolean) {
    val pm = context.packageManager
    val hasUsbHost = pm.hasSystemFeature(PackageManager.FEATURE_USB_HOST)
    val hasCameraPerm = ContextCompat.checkSelfPermission(
      context, Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED

    val attached = usbMonitor.listAttachedVideoDevices()
    val withPermission = attached.count { usbMonitor.hasPermission(it) }

    val support = when {
      !hasUsbHost -> SupportState.UsbHostUnsupported
      !hasCameraPerm -> SupportState.CameraPermissionRequired
      attached.isEmpty() -> SupportState.Disconnected
      withPermission == 0 -> SupportState.UsbPermissionRequired
      else -> status.supportState.takeIf {
        it == SupportState.Ready ||
          it == SupportState.TemporarilyUnavailable ||
          it == SupportState.UsbAttachedNotSupported
      } ?: SupportState.UsbAttachedNotSupported
    }

    val message = when (support) {
      SupportState.UsbHostUnsupported -> "This device does not support USB host mode."
      SupportState.CameraPermissionRequired -> "Allow camera access to use an external camera."
      SupportState.Disconnected -> "Connect an external USB camera to continue."
      SupportState.UsbPermissionRequired -> "Grant access to the USB camera in the system prompt."
      SupportState.UsbAttachedNotSupported -> "USB camera detected, but no usable UVC camera is ready yet."
      SupportState.Ready -> "External camera ready."
      SupportState.TemporarilyUnavailable -> status.message
      else -> status.message
    }

    val next = status.copy(
      supportState = support,
      message = message,
      hasUsbHostFeature = hasUsbHost,
      hasCameraPermission = hasCameraPerm,
      attachedUsbVideoDeviceCount = attached.size,
      usbPermissionCount = withPermission,
    )
    if (next != status) {
      status = next
      if (emit) emitStatus()
    }
  }

  private inline fun updateStatus(transform: (ExternalCameraStatusSnapshot) -> ExternalCameraStatusSnapshot) {
    val next = transform(status)
    if (next != status) {
      status = next
      emitStatus()
    }
  }

  private fun emitStatus() {
    val s = status
    sink?.emit("onExternalCameraStatusChanged", statusToMap(s))
    s.sessionState?.let {
      sink?.emit("onExternalCameraSessionStateChanged", mapOf("sessionState" to it.raw))
    }
  }

  private fun initialStatus() = ExternalCameraStatusSnapshot(
    supportState = SupportState.Unknown,
    message = "Checking external camera...",
    sessionState = SessionState.Inactive,
  )

  companion object {
    private const val TAG = "SVExternalCamera"

    @Volatile
    private var instance: ExternalCameraController? = null

    fun get(context: Context): ExternalCameraController {
      return instance ?: synchronized(this) {
        instance ?: ExternalCameraController(context).also { instance = it }
      }
    }

    fun statusToMap(s: ExternalCameraStatusSnapshot): Map<String, Any?> {
      return mutableMapOf<String, Any?>(
        "state" to s.supportState.raw,
        "message" to s.message,
        "hasUsbHostFeature" to s.hasUsbHostFeature,
        "hasCameraPermission" to s.hasCameraPermission,
        "attachedUsbVideoDeviceCount" to s.attachedUsbVideoDeviceCount,
        "usbPermissionCount" to s.usbPermissionCount,
        "externalCameraCount" to s.externalCameraCount,
        "uvcCameraCount" to s.uvcCameraCount,
        "activeCameraId" to s.activeCameraId,
        "backend" to s.backend,
        "connectionPhase" to s.connectionPhase?.raw,
        "externalModeEnabled" to s.externalModeEnabled,
        "sessionState" to s.sessionState?.raw,
        "previewSurfaceAttached" to s.previewSurfaceAttached,
        "deviceKey" to s.deviceKey,
        "selectedProfile" to s.selectedProfile?.let {
          mapOf("width" to it.width, "height" to it.height, "format" to it.format)
        },
        "attemptedProfiles" to s.attemptedProfiles.map { a ->
          mapOf(
            "profile" to mapOf(
              "width" to a.profile.width,
              "height" to a.profile.height,
              "format" to a.profile.format,
            ),
            "result" to a.result,
            "failureReason" to a.failureReason,
            "attemptIndex" to a.attemptIndex,
          )
        },
        "deviceOffered" to s.deviceOffered.map { o ->
          mapOf(
            "width" to o.width,
            "height" to o.height,
            "format" to o.format,
            "maxFps" to o.maxFps,
            "fpsList" to o.fpsList,
          )
        },
        "lastFailureReason" to s.lastFailureReason,
        "compatibilityMode" to s.compatibilityMode,
      )
    }
  }
}
