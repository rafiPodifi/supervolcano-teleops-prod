package com.supervolcano.externalcamera

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.SurfaceHolder
import com.serenegiant.widget.AspectRatioSurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class PreviewReadyChangeEvent(
  @Field val ready: Boolean = false,
) : Record

class ExternalCameraPreviewView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  val onPreviewReadyChange by EventDispatcher<PreviewReadyChangeEvent>()

  private val surfaceView: AspectRatioSurfaceView = AspectRatioSurfaceView(context).apply {
    layoutParams = LayoutParams(
      LayoutParams.MATCH_PARENT,
      LayoutParams.MATCH_PARENT,
    )
    setAspectRatio(16, 9)
  }

  @Volatile
  private var attachedToWindow: Boolean = false

  private val surfaceCallback = object : SurfaceHolder.Callback {
    override fun surfaceCreated(holder: SurfaceHolder) {
      if (!attachedToWindow) return
      ExternalCameraController.get(this@ExternalCameraPreviewView.context)
        .onPreviewSurfaceCreated(this@ExternalCameraPreviewView, holder.surface)
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}

    override fun surfaceDestroyed(holder: SurfaceHolder) {
      ExternalCameraController.get(this@ExternalCameraPreviewView.context)
        .onPreviewSurfaceDestroyed(this@ExternalCameraPreviewView, holder.surface)
    }
  }

  init {
    setBackgroundColor(Color.BLACK)
    gravity = Gravity.CENTER
    addView(surfaceView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attachedToWindow = true
    surfaceView.holder.removeCallback(surfaceCallback)
    surfaceView.holder.addCallback(surfaceCallback)
    ExternalCameraController.get(context).attachPreviewView(this)
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    attachedToWindow = false
    surfaceView.holder.removeCallback(surfaceCallback)
    ExternalCameraController.get(context).detachPreviewView(this)
  }

  fun emitPreviewReady(ready: Boolean) {
    onPreviewReadyChange(PreviewReadyChangeEvent(ready))
  }

  fun applyAspectRatio(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    post { surfaceView.setAspectRatio(width, height) }
  }
}
