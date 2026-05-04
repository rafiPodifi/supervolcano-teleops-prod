package com.supervolcano.externalcamera

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.SurfaceHolder
import com.serenegiant.widget.AspectRatioSurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

data class PreviewReadyChangeEvent(val ready: Boolean)

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

  private val surfaceCallback = object : SurfaceHolder.Callback {
    override fun surfaceCreated(holder: SurfaceHolder) {
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
    surfaceView.holder.addCallback(surfaceCallback)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    ExternalCameraController.get(context).attachPreviewView(this)
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
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
