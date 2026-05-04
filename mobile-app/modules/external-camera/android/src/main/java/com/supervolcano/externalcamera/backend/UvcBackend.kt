package com.supervolcano.externalcamera.backend

import android.content.Context
import android.hardware.usb.UsbDevice
import android.os.Handler
import android.os.Looper
import android.util.Log
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
      attemptIndex: Int,
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
  private var attemptCursor: Int = 0
  private var hasReachedReady: Boolean = false

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
    negotiated = null
    attemptCursor = 0
    hasReachedReady = false
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
    Log.d(TAG, "connect device vid=${device.vendorId} pid=${device.productId} name=${device.deviceName}")
    listener.onBackendConnecting()
    runCatching { helper.selectDevice(device) }
      .onFailure { e ->
        Log.e(TAG, "selectDevice failed", e)
        listener.onBackendError("select_device_failed:${e.javaClass.simpleName}:${e.message}")
      }
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
      Log.e(TAG, "attachSurface failed", e)
      listener.onBackendError("attach_surface_failed:${e.javaClass.simpleName}:${e.message}")
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
    Log.d(TAG, "onAttach vid=${device.vendorId} pid=${device.productId}")
    runCatching { helper.selectDevice(device) }
  }

  // onDeviceOpen fires when the USB device file descriptor is open. The UVC
  // camera control interface is NOT yet initialized — supportedSizeList will
  // return null until openCamera() runs and onCameraOpen fires.
  override fun onDeviceOpen(device: UsbDevice, isFirstOpen: Boolean) {
    val helper = cameraHelper ?: return
    Log.d(TAG, "onDeviceOpen isFirstOpen=$isFirstOpen — calling openCamera() with default UVCParam")
    hasReachedReady = false
    negotiated = null
    attemptCursor = 0
    runCatching { helper.openCamera() }
      .onFailure { e ->
        Log.e(TAG, "openCamera (default) threw", e)
        listener.onBackendError("open_camera_failed:${e.javaClass.simpleName}:${e.message}")
      }
  }

  // onCameraOpen fires after the UVC control interface is up and the underlying
  // UVCCamera object is constructed. NOW we can query the device's supported
  // formats, negotiate the best profile, switch the preview size, and start.
  override fun onCameraOpen(device: UsbDevice) {
    val helper = cameraHelper ?: return
    Log.d(TAG, "onCameraOpen — querying supportedSizeList")
    val sizes = readSupportedSizeList(helper)
    if (sizes.isEmpty()) {
      // Some cameras populate the descriptor list a hair after onCameraOpen
      // fires. Re-query once after a short delay before declaring failure.
      mainHandler.postDelayed({
        val cur = cameraHelper ?: return@postDelayed
        val retry = readSupportedSizeList(cur)
        if (retry.isEmpty()) {
          Log.w(TAG, "supportedSizeList empty after re-query")
          listener.onBackendNegotiationFailed("no_profiles_offered", emptyList(), emptyList())
          runCatching { cur.closeCamera() }
        } else {
          finishOpenWithSizes(cur, retry)
        }
      }, RE_QUERY_DELAY_MS)
      return
    }
    finishOpenWithSizes(helper, sizes)
  }

  private fun readSupportedSizeList(helper: ICameraHelper): List<Size> {
    return runCatching { helper.supportedSizeList ?: emptyList() }
      .getOrDefault(emptyList())
  }

  private fun finishOpenWithSizes(helper: ICameraHelper, sizes: List<Size>) {
    Log.d(TAG, "supportedSizeList count=${sizes.size}")
    val result = ProfileNegotiator.negotiate(requestedQuality, sizes)
    negotiated = result
    attemptCursor = 0
    if (result.rankedSizes.isEmpty()) {
      listener.onBackendNegotiationFailed("no_profiles_offered", result.attempted, result.offered)
      runCatching { helper.closeCamera() }
      return
    }
    applyCurrentCandidate(helper)
  }

  private fun applyCurrentCandidate(helper: ICameraHelper) {
    val result = negotiated ?: return
    val ranked = result.rankedSizes
    val cursor = attemptCursor
    if (cursor >= ranked.size || cursor >= MAX_OPEN_ATTEMPTS) {
      Log.w(TAG, "negotiation exhausted at cursor=$cursor (max=$MAX_OPEN_ATTEMPTS, ranked=${ranked.size})")
      listener.onBackendNegotiationFailed(
        "negotiation_failed_after_retries",
        result.attempted,
        result.offered,
      )
      runCatching { helper.closeCamera() }
      return
    }
    val size = ranked[cursor]
    val format = ProfileNegotiator.classifyFormat(size)
    val profile = SelectedProfile(size.width, size.height, format)
    Log.d(TAG, "applyCandidate cursor=$cursor size=${size.width}x${size.height} format=$format")

    runCatching { helper.stopPreview() }

    val sizeSet = runCatching { helper.setPreviewSize(size) }
    if (sizeSet.isFailure) {
      val e = sizeSet.exceptionOrNull()
      Log.e(TAG, "setPreviewSize failed at cursor=$cursor", e)
      advanceAndRetry(helper, "set_preview_size_failed:${e?.javaClass?.simpleName}:${e?.message}")
      return
    }

    listener.onBackendConnected(
      profile = profile,
      attempted = result.attempted,
      offered = result.offered,
      attemptIndex = cursor,
    )

    pendingSurface?.let { surface ->
      pendingSurface = null
      attachSurface(surface)
    }

    val started = runCatching { helper.startPreview() }
    if (started.isFailure) {
      val e = started.exceptionOrNull()
      Log.e(TAG, "startPreview threw at cursor=$cursor", e)
      advanceAndRetry(helper, "start_preview_failed:${e?.javaClass?.simpleName}:${e?.message}")
      return
    }
    mainHandler.post {
      isPreviewActive = true
      hasReachedReady = true
      listener.onBackendPreviewReady()
    }
  }

  private fun advanceAndRetry(helper: ICameraHelper, lastReason: String) {
    attemptCursor += 1
    Log.d(TAG, "advanceAndRetry cursor=$attemptCursor lastReason=$lastReason")
    mainHandler.post { cameraHelper?.let { applyCurrentCandidate(it) } }
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
      hasReachedReady = false
      listener.onBackendDetached()
    }
  }

  override fun onCancel(device: UsbDevice) {
    listener.onBackendError("usb_permission_cancelled")
  }

  override fun onError(device: UsbDevice, e: CameraException) {
    val helper = cameraHelper
    val reason = "camera_exception:${e.javaClass.simpleName}:${e.message ?: ""}"
    Log.e(TAG, "onError $reason hasReachedReady=$hasReachedReady cursor=$attemptCursor", e)
    if (!hasReachedReady && helper != null && negotiated != null) {
      // Async preview-start failure — try the next candidate.
      advanceAndRetry(helper, reason)
      return
    }
    listener.onBackendError(reason)
  }

  companion object {
    private const val TAG = "SVExternalCamera"
    private const val MAX_OPEN_ATTEMPTS = 4
    private const val RE_QUERY_DELAY_MS = 200L
  }
}
