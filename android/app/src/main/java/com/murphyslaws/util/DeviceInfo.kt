package com.murphyslaws.util

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

object DeviceInfo {
    private var deviceId: String? = null

    fun getDeviceId(context: Context): String {
        // Return cached value if available
        deviceId?.let { return it }

        // Create encrypted shared preferences
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        val sharedPreferences = EncryptedSharedPreferences.create(
            context,
            "secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        // Get or create device ID
        val id = sharedPreferences.getString(Constants.KEY_DEVICE_ID, null) ?: run {
            val newId = UUID.randomUUID().toString()
            sharedPreferences.edit().putString(Constants.KEY_DEVICE_ID, newId).apply()
            newId
        }

        deviceId = id
        return id
    }
}
