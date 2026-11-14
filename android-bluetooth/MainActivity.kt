package com.koboye.infinity

import android.os.Bundle
import android.view.WindowManager
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(AfroBluetoothPlugin::class.java)   // must come BEFORE super.onCreate
        super.onCreate(savedInstanceState)
        // Blocks screenshots, screen recording, casting and the recent-apps preview for the whole app
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
    }
}
