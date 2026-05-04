package com.supervolcano.externalcamera.util

import com.serenegiant.usb.Size
import com.serenegiant.usb.UVCCamera
import com.supervolcano.externalcamera.AttemptedProfile
import com.supervolcano.externalcamera.OfferedFormat
import com.supervolcano.externalcamera.SelectedProfile
import kotlin.math.abs
import kotlin.math.log2

object ProfileNegotiator {

  data class Result(
    val selected: SelectedProfile?,
    val selectedSize: Size?,
    val attempted: List<AttemptedProfile>,
    val offered: List<OfferedFormat>,
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
    if (supported.isEmpty()) {
      return Result(null, null, emptyList(), emptyList())
    }

    val tier = TIERS[requested] ?: TIERS.getValue("hd")

    data class Scored(val size: Size, val format: String, val fps: Int, val score: Int)

    val scored = supported.map { size ->
      val format = classifyFormat(size)
      val fps = maxFps(size)
      val score = if (format == "unknown") Int.MIN_VALUE else scoreCandidate(size, format, fps, tier)
      Scored(size, format, fps, score)
    }

    val acceptable = scored.filter { it.format != "unknown" }
    if (acceptable.isEmpty()) {
      val attempted = scored.map {
        AttemptedProfile(
          SelectedProfile(it.size.width, it.size.height, "unknown"),
          "failed",
          "unsupported_format:type=${it.size.type}",
        )
      }
      return Result(null, null, attempted, offered)
    }

    val sorted = acceptable.sortedWith(
      compareByDescending<Scored> { it.score }
        .thenByDescending { it.size.width.toLong() * it.size.height }
        .thenByDescending { it.fps }
        .thenByDescending { if (it.format == "mjpeg") 1 else 0 }
    )

    val attempted = mutableListOf<AttemptedProfile>()
    sorted.forEachIndexed { idx, s ->
      val profile = SelectedProfile(s.size.width, s.size.height, s.format)
      attempted += AttemptedProfile(
        profile,
        if (idx == 0) "success" else "failed",
        "score=${s.score}",
      )
    }
    scored.filter { it.format == "unknown" }.forEach {
      attempted += AttemptedProfile(
        SelectedProfile(it.size.width, it.size.height, "unknown"),
        "failed",
        "unsupported_format:type=${it.size.type}",
      )
    }

    val winner = sorted.first()
    val winnerProfile = SelectedProfile(winner.size.width, winner.size.height, winner.format)
    return Result(winnerProfile, winner.size, attempted, offered)
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

  private fun classifyFormat(size: Size): String {
    return when (size.type) {
      UVCCamera.FRAME_FORMAT_MJPEG,
      UVCCamera.UVC_VS_FORMAT_MJPEG,
      UVCCamera.UVC_VS_FRAME_MJPEG -> "mjpeg"
      UVCCamera.FRAME_FORMAT_YUYV,
      UVCCamera.UVC_VS_FORMAT_UNCOMPRESSED,
      UVCCamera.UVC_VS_FRAME_UNCOMPRESSED -> "yuyv"
      else -> "unknown"
    }
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
    val formatScore = if (format == "mjpeg") 1000 else 700
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
      else -> 0
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
