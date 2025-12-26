package com.mobileworshiphost

import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class KeyEventModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeyEventModule"

    fun sendKeyEvent(keyCode: Int, action: Int) {
        val eventName = when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> "up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "down"
            KeyEvent.KEYCODE_DPAD_LEFT -> "left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "select"
            KeyEvent.KEYCODE_BACK -> "back"
            else -> return
        }

        if (action == KeyEvent.ACTION_DOWN) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onKeyDown", eventName)
        }
    }

    companion object {
        var instance: KeyEventModule? = null
    }

    init {
        instance = this
    }
}
