package com.supervolcano.externalcamera

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExternalCameraModule : Module() {

  private val controller: ExternalCameraController
    get() = ExternalCameraController.get(
      appContext.reactContext ?: throw Exceptions.ReactContextLost()
    )

  override fun definition() = ModuleDefinition {
    Name("ExternalCameraModule")

    Events(
      "onCameraAvailabilityChanged",
      "onRecordingStateChanged",
      "onCameraError",
      "onExternalCameraSessionStateChanged",
      "onUsbAttached",
      "onUsbDetached",
      "onUsbPermissionResult",
      "onExternalCameraStatusChanged",
    )

    OnCreate {
      controller.start { name, payload ->
        sendEvent(name, mapToBundle(payload))
      }
    }

    OnDestroy {
      controller.stop()
    }

    AsyncFunction("getAvailableCameras") {
      controller.listAvailableCameras().map { (id, facing) ->
        mapOf("id" to id, "facing" to facing)
      }
    }

    AsyncFunction("getStatus") {
      ExternalCameraController.statusToMap(controller.getStatus())
    }

    AsyncFunction("setActiveCamera") { cameraId: String ->
      controller.setActiveCamera(cameraId)
    }

    AsyncFunction("setExternalModeEnabled") { enabled: Boolean ->
      controller.setExternalModeEnabled(enabled)
    }

    AsyncFunction("startRecording") { outputPath: String, options: Map<String, Any?> ->
      controller.startRecording(outputPath, options)
    }

    AsyncFunction("stopRecording") {
      controller.stopRecording()
    }

    AsyncFunction("retryPreview") {
      controller.retryPreview()
    }

    // Battery-optimization controls. Living on this module to avoid spinning
    // up a new native module for two functions. Used by App.tsx to prompt
    // the user to exempt the app from Android Doze / App Standby so
    // background uploads continue when the screen is off.
    AsyncFunction("isBatteryOptimizationIgnored") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      // Try the direct system dialog first. Requires
      // REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission in the manifest AND
      // a target SDK / OEM that honours it. Falls back to the per-app
      // settings page on any failure, which works on every OEM and is the
      // most direct way to get the user to Battery → Unrestricted.
      val requestIntent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${ctx.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      var launched = false
      if (requestIntent.resolveActivity(ctx.packageManager) != null) {
        try {
          ctx.startActivity(requestIntent)
          launched = true
        } catch (t: Throwable) {
          // Fall through to the app-details settings page below.
        }
      }
      if (!launched) {
        val detailsIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.parse("package:${ctx.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(detailsIntent)
      }
    }

    View(ExternalCameraPreviewView::class) {
      Events("onPreviewReadyChange")
    }
  }

  private fun mapToBundle(map: Map<String, Any?>): Bundle {
    val b = Bundle()
    for ((k, v) in map) {
      when (v) {
        null -> b.putString(k, null)
        is Boolean -> b.putBoolean(k, v)
        is Int -> b.putInt(k, v)
        is Long -> b.putLong(k, v)
        is Double -> b.putDouble(k, v)
        is Float -> b.putFloat(k, v)
        is String -> b.putString(k, v)
        is Map<*, *> -> {
          @Suppress("UNCHECKED_CAST")
          b.putBundle(k, mapToBundle(v as Map<String, Any?>))
        }
        is List<*> -> {
          val first = v.firstOrNull()
          if (first is Int) {
            @Suppress("UNCHECKED_CAST")
            b.putIntegerArrayList(k, ArrayList(v as List<Int>))
          } else {
            val arr = ArrayList<Bundle>()
            for (item in v) {
              if (item is Map<*, *>) {
                @Suppress("UNCHECKED_CAST")
                arr.add(mapToBundle(item as Map<String, Any?>))
              }
            }
            b.putParcelableArrayList(k, arr)
          }
        }
        else -> b.putString(k, v.toString())
      }
    }
    return b
  }
}
