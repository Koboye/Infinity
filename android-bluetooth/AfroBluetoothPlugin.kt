package com.koboye.infinity

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Phone-to-phone Bluetooth (classic RFCOMM) for the Afro Zone race games.
 * The web game talks to this through the "AfroBluetooth" Capacitor plugin (contract in public/games/hillclimb-racing/nearby.js):
 *   available() · listen() · discover() · connect({address}) · send({data}) · close()
 *   events: found {name,address} · connected {name,address} · line {data} · closed · error {message}
 * One RFCOMM stream carries newline-delimited text lines (the web side puts JSON in each line).
 */
@CapacitorPlugin(
    name = "AfroBluetooth",
    permissions = [
        Permission(
            alias = "bt31",
            strings = [Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE]
        ),
        Permission(alias = "loc", strings = [Manifest.permission.ACCESS_FINE_LOCATION]),
    ]
)
@SuppressLint("MissingPermission")   // every entry point below checks / requests permission first
class AfroBluetoothPlugin : Plugin() {

    companion object {
        // Fixed service id both phones use (any random UUID, must be the same in every copy of the app).
        val SERVICE_UUID: UUID = UUID.fromString("7e5a1f90-4c3b-4a8e-9d21-a3f0a1b2c3d4")
        const val SERVICE_NAME = "AfroZoneRace"
    }

    private val io = Executors.newCachedThreadPool()
    private val writer = Executors.newSingleThreadExecutor()
    @Volatile private var server: BluetoothServerSocket? = null
    @Volatile private var socket: BluetoothSocket? = null
    @Volatile private var out: OutputStream? = null
    private var receiver: BroadcastReceiver? = null

    private fun adapter(): BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private fun permAlias() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) "bt31" else "loc"
    private fun hasPerm() = getPermissionState(permAlias()) == PermissionState.GRANTED

    private fun emit(name: String, build: JSObject.() -> Unit = {}) = notifyListeners(name, JSObject().apply(build))

    /** Ask for the right permission set (Android 12+: nearby devices; older: location), then run [next]. */
    private fun withPerm(call: PluginCall, next: String) {
        if (hasPerm()) { when (next) { "doListen" -> doListen(call); "doDiscover" -> doDiscover(call); "doConnect" -> doConnect(call) }; return }
        requestPermissionForAlias(permAlias(), call, next)
    }
    @PermissionCallback private fun doListen(call: PluginCall) { if (!hasPerm()) call.reject("Bluetooth permission denied") else startListening(call) }
    @PermissionCallback private fun doDiscover(call: PluginCall) { if (!hasPerm()) call.reject("Bluetooth permission denied") else startDiscovery(call) }
    @PermissionCallback private fun doConnect(call: PluginCall) { if (!hasPerm()) call.reject("Bluetooth permission denied") else startConnect(call) }

    @PluginMethod
    fun available(call: PluginCall) {
        val a = adapter()
        call.resolve(JSObject().put("available", a != null).put("enabled", a?.isEnabled == true))
    }

    @PluginMethod fun listen(call: PluginCall) = withPerm(call, "doListen")
    @PluginMethod fun discover(call: PluginCall) = withPerm(call, "doDiscover")
    @PluginMethod fun connect(call: PluginCall) = withPerm(call, "doConnect")

    private fun startListening(call: PluginCall) {
        val a = adapter() ?: return call.reject("No Bluetooth")
        closeAll()
        try {
            server = a.listenUsingRfcommWithServiceRecord(SERVICE_NAME, SERVICE_UUID)
            // make this phone visible for 2 minutes so the other phone can find it
            activity.startActivity(Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE).putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 120))
        } catch (e: Exception) { return call.reject("Could not start Bluetooth: ${e.message}") }
        call.resolve()
        val srv = server
        io.execute {
            try {
                val s = srv?.accept()          // blocks until the other phone connects
                try { srv?.close() } catch (_: Exception) {}
                if (s != null) attach(s)
            } catch (e: Exception) { if (server === srv) emit("error") { put("message", "Waiting ended: ${e.message}") } }
        }
    }

    private fun startDiscovery(call: PluginCall) {
        val a = adapter() ?: return call.reject("No Bluetooth")
        stopDiscovery()
        // phones already paired are listed first (the host may be one of them)
        a.bondedDevices?.forEach { emit("found") { put("name", it.name ?: "Phone"); put("address", it.address) } }
        receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                if (i.action == BluetoothDevice.ACTION_FOUND) {
                    val d: BluetoothDevice? = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java) else @Suppress("DEPRECATION") i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    if (d != null) emit("found") { put("name", d.name ?: "Phone"); put("address", d.address) }
                }
            }
        }
        context.registerReceiver(receiver, IntentFilter(BluetoothDevice.ACTION_FOUND))
        a.startDiscovery()
        call.resolve()
        io.execute { try { Thread.sleep(25_000) } catch (_: Exception) {}; stopDiscovery() }
    }

    private fun stopDiscovery() {
        try { adapter()?.cancelDiscovery() } catch (_: Exception) {}
        receiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
        receiver = null
    }

    private fun startConnect(call: PluginCall) {
        val addr = call.getString("address") ?: return call.reject("address missing")
        val a = adapter() ?: return call.reject("No Bluetooth")
        stopDiscovery()   // discovery slows a connection down a lot
        call.resolve()
        io.execute {
            try {
                val s = a.getRemoteDevice(addr).createRfcommSocketToServiceRecord(SERVICE_UUID)
                s.connect()
                attach(s)
            } catch (e: Exception) { emit("error") { put("message", "Could not connect: ${e.message}") } }
        }
    }

    /** One connected phone: tell the web game, then read lines until the link drops. */
    private fun attach(s: BluetoothSocket) {
        socket = s; out = s.outputStream
        emit("connected") { put("name", s.remoteDevice?.name ?: "Phone"); put("address", s.remoteDevice?.address ?: "") }
        io.execute {
            try {
                val r = BufferedReader(InputStreamReader(s.inputStream, Charsets.UTF_8))
                while (true) { val line = r.readLine() ?: break; emit("line") { put("data", line) } }
            } catch (_: Exception) { /* link dropped */ }
            if (socket === s) { closeAll(); emit("closed") }
        }
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val data = call.getString("data") ?: return call.reject("data missing")
        val o = out ?: return call.reject("Not connected")
        writer.execute {   // one writer thread keeps lines in order and off the UI thread
            try { synchronized(o) { o.write((data + "\n").toByteArray(Charsets.UTF_8)); o.flush() } }
            catch (e: Exception) { closeAll(); emit("closed") }
        }
        call.resolve()
    }

    @PluginMethod fun close(call: PluginCall) { closeAll(); call.resolve() }

    private fun closeAll() {
        stopDiscovery()
        try { server?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        server = null; socket = null; out = null
    }

    override fun handleOnDestroy() { closeAll(); io.shutdownNow(); writer.shutdownNow() }
}
