package com.supervolcano.externalcamera

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build

class UsbDeviceMonitor(
  private val context: Context,
  private val listener: Listener,
) {
  interface Listener {
    fun onUsbAttached(device: UsbDevice, hasPermission: Boolean)
    fun onUsbDetached(device: UsbDevice)
    fun onUsbPermissionResult(device: UsbDevice?, granted: Boolean)
  }

  private val usbManager: UsbManager =
    context.getSystemService(Context.USB_SERVICE) as UsbManager

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
      val device: UsbDevice? = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
          intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        else -> @Suppress("DEPRECATION")
          intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
      }

      when (intent.action) {
        UsbManager.ACTION_USB_DEVICE_ATTACHED -> device?.let {
          listener.onUsbAttached(it, usbManager.hasPermission(it))
        }
        UsbManager.ACTION_USB_DEVICE_DETACHED -> device?.let {
          listener.onUsbDetached(it)
        }
        ACTION_USB_PERMISSION -> {
          val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
          listener.onUsbPermissionResult(device, granted)
        }
      }
    }
  }

  private var registered = false

  fun start() {
    if (registered) return
    val filter = IntentFilter().apply {
      addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
      addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
      addAction(ACTION_USB_PERMISSION)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter)
    }
    registered = true
  }

  fun stop() {
    if (!registered) return
    runCatching { context.unregisterReceiver(receiver) }
    registered = false
  }

  fun listAttachedVideoDevices(): List<UsbDevice> =
    usbManager.deviceList.values.filter(::isUvcDevice)

  fun hasPermission(device: UsbDevice): Boolean = usbManager.hasPermission(device)

  fun requestPermission(device: UsbDevice) {
    val intent = Intent(ACTION_USB_PERMISSION).setPackage(context.packageName)
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val pi = PendingIntent.getBroadcast(context, 0, intent, flags)
    usbManager.requestPermission(device, pi)
  }

  companion object {
    const val ACTION_USB_PERMISSION =
      "com.supervolcano.externalcamera.USB_PERMISSION"

    fun isUvcDevice(device: UsbDevice): Boolean {
      for (i in 0 until device.interfaceCount) {
        val iface = device.getInterface(i)
        if (iface.interfaceClass == UsbConstants.USB_CLASS_VIDEO) return true
      }
      return false
    }
  }
}
