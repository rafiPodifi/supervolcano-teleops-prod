package com.supervolcano.externalcamera.backend

import android.content.Context
import android.hardware.usb.UsbDevice
import android.os.Handler
import android.os.Looper
import com.herohan.uvcapp.CameraException
import com.herohan.uvcapp.CameraHelper
import com.herohan.uvcapp.ICameraHelper
import com.serenegiant.usb.Size
import com.supervolcano.externalcamera.AttemptedProfile
import com.supervolcano.externalcamera.OfferedFormat
import com.supervolcano.externalcamera.SelectedProfile
import com.supervolcano.externalcamera.util.ProfileNegotiator

class UvcBackend(
  private val context: Context,
  private val listener: Listener,
) : ICameraHelper.StateCallback {

  interface Listener {
    fun onBackendConnecting()
    fun onBackendConnected(
      profile: SelectedProfile,
      attempted: List<AttemptedProfile>,
      offered: List<OfferedFormat>,
    )
    fun onBackendNegotiationFailed(
      reason: String,
      attempted: List<AttemptedProfile>,
      offered: List<OfferedFormat>,
    )
    fun onBackendPreviewReady()
    fun onBackendError(reason: String)
    fun onBackendDetached()
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var cameraHelper: ICameraHelper? = null
  private var currentDevice: UsbDevice? = null
  private var pendingSurface: Any? = null
  private var attachedSurface: Any? = null
  private var requestedQuality: String = "hd"
  private var negotiated: ProfileNegotiator.Result? = null

  @Volatile
  var isPreviewActive: Boolean = false
    private set

  fun start() {
    if (cameraHelper != null) return
    cameraHelper = CameraHelper().also { helper ->
      helper.setStateCallback(this)
    }
  }

  fun stop() {
    runCatching { cameraHelper?.releaseAll() }
    cameraHelper = null
    currentDevice = null
    pendingSurface = null
    attachedSurface = null
    isPreviewActive = false
  }

  fun setQuality(quality: String) {
    requestedQuality = quality
  }

  fun connectFirstAvailable() {
    val helper = cameraHelper ?: run {
      listener.onBackendError("backend_not_started")
      return
    }
    val device = helper.deviceList.firstOrNull() ?: run {
      listener.onBackendError("no_uvc_device_attached")
      return
    }
    connect(device)
  }

  fun connect(device: UsbDevice) {
    val helper = cameraHelper ?: run {
      listener.onBackendError("backend_not_started")
      return
    }
    if (currentDevice != null) return
    listener.onBackendConnecting()
    runCatching { helper.selectDevice(device) }
      .onFailure { e -> listener.onBackendError("select_device_failed:${e.message}") }
  }

  fun attachSurface(surface: Any) {
    val helper = cameraHelper
    if (helper == null || !helper.isCameraOpened) {
      pendingSurface = surface
      return
    }
    runCatching {
      attachedSurface?.let { helper.removeSurface(it) }
      helper.addSurface(surface, false)
      attachedSurface = surface
    }.onFailure { e ->
      listener.onBackendError("attach_surface_failed:${e.message}")
    }
  }

  fun detachSurface(surface: Any) {
    if (pendingSurface === surface) pendingSurface = null
    val helper = cameraHelper ?: return
    if (attachedSurface === surface) {
      runCatching { helper.removeSurface(surface) }
      attachedSurface = null
      isPreviewActive = false
    }
  }

  override fun onAttach(device: UsbDevice) {
    val helper = cameraHelper ?: return
    if (currentDevice != null) return
    currentDevice = device
    runCatching { helper.selectDevice(device) }
  }

  override fun onDeviceOpen(device: UsbDevice, isFirstOpen: Boolean) {
    val helper = cameraHelper ?: return
    val sizes: List<Size> = runCatching { helper.supportedSizeList ?: emptyList() }.getOrDefault(emptyList())
    val result = ProfileNegotiator.negotiate(requestedQuality, sizes)
    negotiated = result
    if (result.selectedSize == null) {
      listener.onBackendNegotiationFailed("no_supported_profile", result.attempted, result.offered)
      runCatching { helper.closeCamera() }
      return
    }
    runCatching { helper.openCamera(result.selectedSize) }
      .onFailure { e -> listener.onBackendError("open_camera_failed:${e.message}") }
  }

  override fun onCameraOpen(device: UsbDevice) {
    val helper = cameraHelper ?: return
    val result = negotiated
    val profile = result?.selected
    val attempted = result?.attempted ?: emptyList()
    val offered = result?.offered ?: emptyList()
    if (profile != null) {
      listener.onBackendConnected(profile, attempted, offered)
    }
    pendingSurface?.let { surface ->
      pendingSurface = null
      attachSurface(surface)
    }
    runCatching { helper.startPreview() }
      .onFailure { e -> listener.onBackendError("start_preview_failed:${e.message}") }
    mainHandler.post {
      isPreviewActive = true
      listener.onBackendPreviewReady()
    }
  }

  override fun onCameraClose(device: UsbDevice) {
    isPreviewActive = false
  }

  override fun onDeviceClose(device: UsbDevice) {
    if (currentDevice == device) currentDevice = null
  }

  override fun onDetach(device: UsbDevice) {
    if (currentDevice == device) {
      currentDevice = null
      isPreviewActive = false
      listener.onBackendDetached()
    }
  }

  override fun onCancel(device: UsbDevice) {
    listener.onBackendError("usb_permission_cancelled")
  }

  override fun onError(device: UsbDevice, e: CameraException) {
    listener.onBackendError("camera_exception:${e.message ?: e.javaClass.simpleName}")
  }
}
