package com.koboye.infinity

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(AfroBluetoothPlugin::class.java)   // must come BEFORE super.onCreate
        super.onCreate(savedInstanceState)
    }
}
