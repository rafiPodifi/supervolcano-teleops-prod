package com.supervolcano.externalcamera.util

import android.util.Log
import com.serenegiant.usb.Size
import com.serenegiant.usb.UVCCamera
import com.supervolcano.externalcamera.AttemptedProfile
import com.supervolcano.externalcamera.OfferedFormat
import com.supervolcano.externalcamera.SelectedProfile
import kotlin.math.abs
import kotlin.math.log2

// UVC Video Streaming descriptor subtype values (UVC 1.5 spec, table 3-1).
// CameraHelper.supportedSizeList exposes Size.type as one of these raw ints.
// We accept everything libuvc can stream and rank by likelihood of working.
private const val VS_FORMAT_UNCOMPRESSED = 0x04
private const val VS_FRAME_UNCOMPRESSED = 0x05
private const val VS_FORMAT_MJPEG = 0x06
private const val VS_FRAME_MJPEG = 0x07
private const val VS_FORMAT_MPEG2TS = 0x0A
private const val VS_FORMAT_DV = 0x0C
private const val VS_FORMAT_FRAME_BASED = 0x10
private const val VS_FRAME_FRAME_BASED = 0x11
private const val VS_FORMAT_STREAM_BASED = 0x12
private const val VS_FORMAT_H264 = 0x13
private const val VS_FRAME_H264 = 0x14
private const val VS_FORMAT_H264_SIMULCAST = 0x15
private const val VS_FORMAT_VP8 = 0x16
private const val VS_FRAME_VP8 = 0x17

// Serenegiant FRAME_FORMAT_* (driver-internal enum, distinct from VS_* above).
private const val FF_YUYV = 0
private const val FF_MJPEG = 1
private const val FF_H264 = 2
private const val FF_VP8 = 3
private const val FF_MPEG2TS = 4

object ProfileNegotiator {

  private const val TAG = "SVExternalCamera"

  data class Result(
    val selected: SelectedProfile?,
    val selectedSize: Size?,
    val attempted: List<AttemptedProfile>,
    val offered: List<OfferedFormat>,
    val rankedSizes: List<Size> = emptyList(),
  )

  private data class Tier(val width: Int, val height: Int) {
    val pixels: Long = width.toLong() * height
  }

  private val TIERS: Map<String, Tier> = mapOf(
    "highest" to Tier(1920, 1080),
    "fhd" to Tier(1920, 1080),
    "hd" to Tier(1280, 720),
    "sd" to Tier(640, 480),
  )

  private const val CEILING_OVERSHOOT = 1.10

  fun negotiate(requested: String, supported: List<Size>): Result {
    val offered = toOfferedFormats(supported)
    Log.d(TAG, "negotiate(requested=$requested) offered=${offered.size} sizes")
    if (supported.isEmpty()) {
      return Result(null, null, emptyList(), emptyList(), emptyList())
    }

    val tier = TIERS[requested] ?: TIERS.getValue("hd")

    data class Scored(val size: Size, val format: String, val fps: Int, val score: Int)

    val scored = supported.map { size ->
      val format = classifyFormat(size)
      val fps = maxFps(size)
      val score = scoreCandidate(size, format, fps, tier)
      Log.d(
        TAG,
        "candidate ${size.width}x${size.height} type=${size.type} format=$format fps=$fps score=$score",
      )
      Scored(size, format, fps, score)
    }

    val sorted = scored.sortedWith(
      compareByDescending<Scored> { it.score }
        .thenByDescending { formatRank(it.format) }
        .thenByDescending { it.size.width.toLong() * it.size.height }
        .thenByDescending { it.fps }
    )

    val attempted = sorted.mapIndexed { idx, s ->
      val profile = SelectedProfile(s.size.width, s.size.height, s.format)
      AttemptedProfile(
        profile = profile,
        result = if (idx == 0) "success" else "failed",
        failureReason = "score=${s.score}${if (s.format == "unknown") " unsupported_format:type=${s.size.type}" else ""}",
        attemptIndex = idx,
      )
    }

    val winner = sorted.first()
    val winnerProfile = SelectedProfile(winner.size.width, winner.size.height, winner.format)
    Log.d(TAG, "winner ${winner.size.width}x${winner.size.height} ${winner.format} score=${winner.score}")
    return Result(winnerProfile, winner.size, attempted, offered, sorted.map { it.size })
  }

  fun toOfferedFormats(supported: List<Size>): List<OfferedFormat> {
    return supported.map { s ->
      val list = fpsListOf(s)
      val max = list.maxOrNull() ?: readFps(s)
      OfferedFormat(
        width = s.width,
        height = s.height,
        format = classifyFormat(s),
        maxFps = max,
        fpsList = list,
      )
    }
  }

  // Map every UVC descriptor we can name to a bucket. Anything unmapped becomes
  // "unknown" but is still offered to the backend — never use this to reject.
  fun classifyFormat(size: Size): String {
    val type = size.type
    // First try the symbolic constants from the library version we link against.
    // Fall through to the raw int comparison for codes the lib does not expose.
    when (type) {
      UVCCamera.FRAME_FORMAT_MJPEG,
      UVCCamera.UVC_VS_FORMAT_MJPEG,
      UVCCamera.UVC_VS_FRAME_MJPEG -> return "mjpeg"
      UVCCamera.FRAME_FORMAT_YUYV,
      UVCCamera.UVC_VS_FORMAT_UNCOMPRESSED,
      UVCCamera.UVC_VS_FRAME_UNCOMPRESSED -> return "yuyv"
    }
    return when (type) {
      VS_FORMAT_MJPEG, VS_FRAME_MJPEG, FF_MJPEG -> "mjpeg"
      VS_FORMAT_UNCOMPRESSED, VS_FRAME_UNCOMPRESSED, FF_YUYV -> "yuyv"
      VS_FORMAT_H264, VS_FRAME_H264, VS_FORMAT_H264_SIMULCAST, FF_H264 -> "h264"
      VS_FORMAT_FRAME_BASED, VS_FRAME_FRAME_BASED, VS_FORMAT_STREAM_BASED -> "frame_based"
      VS_FORMAT_MPEG2TS, FF_MPEG2TS -> "mpeg2ts"
      VS_FORMAT_VP8, VS_FRAME_VP8, FF_VP8 -> "vp8"
      VS_FORMAT_DV -> "dv"
      else -> "unknown"
    }
  }

  private fun formatRank(format: String): Int = when (format) {
    "mjpeg" -> 6
    "yuyv" -> 5
    "h264" -> 4
    "frame_based" -> 3
    "mpeg2ts", "vp8", "dv" -> 2
    else -> 1
  }

  private fun fpsListOf(size: Size): List<Int> {
    return runCatching {
      val raw = size.fpsList ?: return@runCatching emptyList<Int>()
      raw.mapNotNull { (it as? Number)?.toInt() }
    }.getOrDefault(emptyList())
  }

  private fun readFps(size: Size): Int {
    return runCatching { size.fps }.getOrDefault(0).coerceAtLeast(0)
  }

  private fun maxFps(size: Size): Int {
    return fpsListOf(size).maxOrNull() ?: readFps(size)
  }

  private fun scoreCandidate(size: Size, format: String, fps: Int, tier: Tier): Int {
    val formatScore = when (format) {
      "mjpeg" -> 1000
      "yuyv" -> 850
      "h264" -> 750
      "frame_based" -> 600
      "mpeg2ts", "vp8", "dv" -> 450
      else -> 300
    }
    val sizePixels = (size.width.toLong() * size.height).coerceAtLeast(1L)
    val ratio = sizePixels.toDouble() / tier.pixels.toDouble()
    val sizeScore = if (ratio > CEILING_OVERSHOOT) {
      (-300.0 * log2(ratio)).toInt()
    } else {
      val deviation = abs(log2(ratio))
      (400.0 * (1.0 - deviation)).toInt()
    }
    val height = size.height.coerceAtLeast(1)
    val aspect = size.width.toDouble() / height
    val aspectScore = when {
      abs(aspect - 16.0 / 9.0) < 0.02 -> 200
      abs(aspect - 4.0 / 3.0) < 0.02 -> 120
      abs(aspect - 16.0 / 10.0) < 0.02 -> 100
      abs(aspect - 1.0) < 0.05 -> 60
      else -> 30
    }
    val fpsScore = when {
      fps >= 24 -> 150
      fps >= 15 -> 80
      fps > 0 -> 30
      else -> 0
    }
    return formatScore + sizeScore + aspectScore + fpsScore
  }
}
