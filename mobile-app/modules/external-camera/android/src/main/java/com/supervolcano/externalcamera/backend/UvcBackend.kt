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

  enum class State {
    IDLE,
    DEVICE_SELECTED,
    CAMERA_OPENING,
    CAMERA_OPEN,
    PREVIEW_STARTING,
    PREVIEW_READY,
    STOPPING,
  }

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
  var state: State = State.IDLE
    private set

  @Volatile
  var isPreviewActive: Boolean = false
    private set

  /** Idempotent. Creates the long-lived CameraHelper. Call from Module.OnCreate. */
  fun init() {
    if (cameraHelper != null) return
    Log.d(TAG, "init: creating CameraHelper")
    cameraHelper = CameraHelper().also { helper ->
      helper.setStateCallback(this)
    }
  }

  /** Full teardown — only from Module.OnDestroy. */
  fun release() {
    Log.d(TAG, "release: full teardown (state=$state)")
    transition(State.STOPPING)
    runCatching { cameraHelper?.releaseAll() }
      .onFailure { Log.w(TAG, "releaseAll threw", it) }
    cameraHelper = null
    currentDevice = null
    pendingSurface = null
    attachedSurface = null
    isPreviewActive = false
    negotiated = null
    attemptCursor = 0
    hasReachedReady = false
    transition(State.IDLE)
  }

  /**
   * Soft close — stops preview, removes surface, closes the UVC control interface.
   * Helper survives. Device stays selected at the library level.
   * Idempotent — safe to call from any state.
   */
  fun closeCamera() {
    val helper = cameraHelper
    Log.d(TAG, "closeCamera: state=$state device=${currentDevice?.deviceName}")
    if (helper == null) {
      transition(State.IDLE)
      return
    }
    if (state == State.IDLE || state == State.DEVICE_SELECTED || state == State.STOPPING) {
      return
    }
    transition(State.STOPPING)
    runCatching { helper.stopPreview() }
      .onFailure { Log.w(TAG, "stopPreview threw", it) }
    attachedSurface?.let { surface ->
      runCatching { helper.removeSurface(surface) }
        .onFailure { Log.w(TAG, "removeSurface threw", it) }
    }
    attachedSurface = null
    pendingSurface = null
    isPreviewActive = false
    negotiated = null
    attemptCursor = 0
    hasReachedReady = false
    runCatching { helper.closeCamera() }
      .onFailure { Log.w(TAG, "closeCamera threw", it) }
    // onCameraClose / onDeviceClose finalize the transition asynchronously.
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

  /**
   * Connect to a device. Idempotent for repeat calls with the same device:
   * — if already PREVIEW_READY, re-emits the ready event for the new view
   * — if device is selected but camera is closed, re-opens the camera
   * — if a different device is currently selected, closes it first
   */
  fun connect(device: UsbDevice) {
    val helper = cameraHelper ?: run {
      listener.onBackendError("backend_not_started")
      return
    }
    val sameDevice = currentDevice?.deviceName == device.deviceName
    when {
      sameDevice && state == State.PREVIEW_READY -> {
        Log.d(TAG, "connect: preview already ready for ${device.deviceName}, re-emitting")
        listener.onBackendPreviewReady()
      }
      sameDevice && (state == State.CAMERA_OPENING || state == State.PREVIEW_STARTING) -> {
        Log.d(TAG, "connect: already opening ${device.deviceName} (state=$state)")
      }
      sameDevice && state == State.DEVICE_SELECTED -> {
        Log.d(TAG, "connect: re-opening camera for already-selected ${device.deviceName}")
        listener.onBackendConnecting()
        openCameraIfNeeded()
      }
      else -> {
        if (currentDevice != null && !sameDevice) {
          Log.d(TAG, "connect: closing previous device before selecting ${device.deviceName}")
          closeCamera()
        }
        Log.d(TAG, "connect: selectDevice vid=${device.vendorId} pid=${device.productId} name=${device.deviceName}")
        listener.onBackendConnecting()
        runCatching { helper.selectDevice(device) }
          .onFailure { e ->
            Log.e(TAG, "selectDevice failed", e)
            listener.onBackendError("select_device_failed:${e.javaClass.simpleName}:${e.message}")
          }
      }
    }
  }

  /**
   * Reopen the UVC control interface when a device is already selected at the
   * library level (after a previous closeCamera() soft close).
   */
  fun openCameraIfNeeded() {
    val helper = cameraHelper ?: return
    val device = currentDevice ?: return
    when (state) {
      State.CAMERA_OPENING, State.CAMERA_OPEN, State.PREVIEW_STARTING, State.PREVIEW_READY -> return
      else -> {}
    }
    Log.d(TAG, "openCameraIfNeeded: opening camera for ${device.deviceName}")
    hasReachedReady = false
    negotiated = null
    attemptCursor = 0
    transition(State.CAMERA_OPENING)
    runCatching { helper.openCamera() }
      .onFailure { e ->
        Log.e(TAG, "openCamera failed", e)
        transition(State.DEVICE_SELECTED)
        listener.onBackendError("open_camera_failed:${e.javaClass.simpleName}:${e.message}")
      }
  }

  fun attachSurface(surface: Any) {
    if (state == State.STOPPING) {
      Log.d(TAG, "attachSurface: skipped, state=STOPPING")
      pendingSurface = surface
      return
    }
    val helper = cameraHelper
    if (helper == null || !helper.isCameraOpened) {
      pendingSurface = surface
      Log.d(TAG, "attachSurface: queued (camera not open, state=$state)")
      return
    }
    runCatching {
      attachedSurface?.let { existing ->
        if (existing !== surface) helper.removeSurface(existing)
      }
      helper.addSurface(surface, false)
      attachedSurface = surface
      if (pendingSurface === surface) pendingSurface = null
    }.onFailure { e ->
      Log.e(TAG, "attachSurface failed", e)
      listener.onBackendError("attach_surface_failed:${e.javaClass.simpleName}:${e.message}")
    }
  }

  fun detachSurface(surface: Any) {
    if (pendingSurface === surface) pendingSurface = null
    val helper = cameraHelper ?: return
    if (attachedSurface !== surface) return
    if (state == State.CAMERA_OPENING) {
      // Camera mid-open — don't poke the library. Drop our reference and let
      // closeCamera/release tear it down cleanly later.
      attachedSurface = null
      isPreviewActive = false
      return
    }
    runCatching { helper.removeSurface(surface) }
      .onFailure { Log.w(TAG, "removeSurface threw", it) }
    attachedSurface = null
    isPreviewActive = false
  }

  override fun onAttach(device: UsbDevice) {
    val helper = cameraHelper ?: return
    if (currentDevice != null) return
    currentDevice = device
    Log.d(TAG, "onAttach vid=${device.vendorId} pid=${device.productId}")
    runCatching { helper.selectDevice(device) }
      .onFailure { Log.w(TAG, "selectDevice from onAttach threw", it) }
  }

  override fun onDeviceOpen(device: UsbDevice, isFirstOpen: Boolean) {
    val helper = cameraHelper ?: return
    Log.d(TAG, "onDeviceOpen isFirstOpen=$isFirstOpen — calling openCamera()")
    currentDevice = device
    if (state != State.CAMERA_OPENING) transition(State.CAMERA_OPENING)
    hasReachedReady = false
    negotiated = null
    attemptCursor = 0
    runCatching { helper.openCamera() }
      .onFailure { e ->
        Log.e(TAG, "openCamera (default) threw", e)
        transition(State.DEVICE_SELECTED)
        listener.onBackendError("open_camera_failed:${e.javaClass.simpleName}:${e.message}")
      }
  }

  override fun onCameraOpen(device: UsbDevice) {
    val helper = cameraHelper ?: return
    Log.d(TAG, "onCameraOpen — querying supportedSizeList")
    transition(State.CAMERA_OPEN)
    val sizes = readSupportedSizeList(helper)
    if (sizes.isEmpty()) {
      mainHandler.postDelayed({
        val cur = cameraHelper ?: return@postDelayed
        if (state != State.CAMERA_OPEN) return@postDelayed
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

    transition(State.PREVIEW_STARTING)
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
      transition(State.PREVIEW_READY)
      listener.onBackendPreviewReady()
    }
  }

  private fun advanceAndRetry(helper: ICameraHelper, lastReason: String) {
    attemptCursor += 1
    Log.d(TAG, "advanceAndRetry cursor=$attemptCursor lastReason=$lastReason")
    mainHandler.post { cameraHelper?.let { applyCurrentCandidate(it) } }
  }

  override fun onCameraClose(device: UsbDevice) {
    Log.d(TAG, "onCameraClose")
    isPreviewActive = false
    attachedSurface = null
    negotiated = null
    attemptCursor = 0
    hasReachedReady = false
    if (state != State.STOPPING) {
      transition(if (currentDevice != null) State.DEVICE_SELECTED else State.IDLE)
    }
  }

  override fun onDeviceClose(device: UsbDevice) {
    Log.d(TAG, "onDeviceClose")
    if (currentDevice == device) currentDevice = null
    if (state != State.STOPPING) transition(State.IDLE)
  }

  override fun onDetach(device: UsbDevice) {
    Log.d(TAG, "onDetach")
    if (currentDevice == device) {
      currentDevice = null
      attachedSurface = null
      pendingSurface = null
      isPreviewActive = false
      hasReachedReady = false
      transition(State.IDLE)
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
      advanceAndRetry(helper, reason)
      return
    }
    closeCamera()
    listener.onBackendError(reason)
  }

  private fun transition(next: State) {
    val prev = state
    if (prev == next) return
    state = next
    Log.d(TAG, "state $prev → $next")
  }

  companion object {
    private const val TAG = "SVExternalCamera"
    private const val MAX_OPEN_ATTEMPTS = 4
    private const val RE_QUERY_DELAY_MS = 200L
  }
}
