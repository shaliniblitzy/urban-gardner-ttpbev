package com.gardenplanner.core.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.google.gson.Gson
import java.util.Date

/**
 * Manages application preferences and settings with built-in encryption support.
 * Provides secure storage for sensitive data using EncryptedSharedPreferences
 * and regular storage for non-sensitive data.
 * 
 * @version 1.0
 * @since 2024-01
 */
class PreferencesManager(context: Context) {

    companion object {
        private const val PREF_NAME = "garden_planner_preferences"

        // Preference keys for different data types
        object Keys {
            const val GARDEN_DATA = "garden_data"
            const val USER_PREFERENCES = "user_preferences"
            const val SCHEDULE_DATA = "schedule_data"
            const val PLANT_DATABASE = "plant_database"
            const val NOTIFICATION_SETTINGS = "notification_settings"
            const val LAST_SYNC = "last_sync"
        }

        // Retention periods for different data types
        object RetentionPeriods {
            const val GARDEN_LAYOUTS = "permanent"
            const val SCHEDULES = "365_days"
            const val USER_PREFERENCES = "permanent"
            const val PLANT_DATABASE = "version_based"
        }
    }

    private val encryptedPreferences: SharedPreferences
    private val regularPreferences: SharedPreferences
    private val gson: Gson = Gson()

    init {
        // Generate or retrieve master key for encryption
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

        // Initialize encrypted preferences for sensitive data
        encryptedPreferences = EncryptedSharedPreferences.create(
            "${PREF_NAME}_encrypted",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        // Initialize regular preferences for non-sensitive data
        regularPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Stores a string value in preferences with optional encryption.
     *
     * @param key The key to store the value under
     * @param value The string value to store
     * @param encrypt Whether to use encrypted storage
     */
    fun setString(key: String, value: String, encrypt: Boolean = false) {
        require(key.isNotBlank()) { "Key cannot be blank" }
        
        val prefs = if (encrypt) encryptedPreferences else regularPreferences
        prefs.edit().apply {
            putString(key, value)
            apply()
        }
    }

    /**
     * Retrieves a string value from preferences.
     *
     * @param key The key to retrieve the value for
     * @param encrypted Whether to use encrypted storage
     * @return The stored string value or null if not found
     */
    fun getString(key: String, encrypted: Boolean = false): String? {
        require(key.isNotBlank()) { "Key cannot be blank" }
        
        val prefs = if (encrypted) encryptedPreferences else regularPreferences
        return prefs.getString(key, null)
    }

    /**
     * Stores an object as JSON in preferences with optional encryption.
     *
     * @param key The key to store the value under
     * @param value The object to store
     * @param encrypt Whether to use encrypted storage
     */
    fun setObject(key: String, value: Any, encrypt: Boolean = false) {
        require(key.isNotBlank()) { "Key cannot be blank" }
        
        val json = gson.toJson(value)
        val prefs = if (encrypt) encryptedPreferences else regularPreferences
        prefs.edit().apply {
            putString(key, json)
            apply()
        }
    }

    /**
     * Retrieves and deserializes an object from preferences.
     *
     * @param key The key to retrieve the value for
     * @param type The class type to deserialize to
     * @param encrypted Whether to use encrypted storage
     * @return The deserialized object or null if not found
     */
    fun <T> getObject(key: String, type: Class<T>, encrypted: Boolean = false): T? {
        require(key.isNotBlank()) { "Key cannot be blank" }
        
        val prefs = if (encrypted) encryptedPreferences else regularPreferences
        val json = prefs.getString(key, null) ?: return null
        return try {
            gson.fromJson(json, type)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Removes a value from preferences.
     *
     * @param key The key to remove
     * @param encrypted Whether to use encrypted storage
     */
    fun remove(key: String, encrypted: Boolean = false) {
        require(key.isNotBlank()) { "Key cannot be blank" }
        
        val prefs = if (encrypted) encryptedPreferences else regularPreferences
        prefs.edit().apply {
            remove(key)
            apply()
        }
    }

    /**
     * Clears all preferences data from both regular and encrypted storage.
     */
    fun clear() {
        regularPreferences.edit().clear().apply()
        encryptedPreferences.edit().clear().apply()
    }

    /**
     * Removes expired data based on retention policies.
     * Schedules older than 365 days are removed.
     */
    fun cleanupExpiredData() {
        // Clean up schedules older than 365 days
        getObject(Keys.SCHEDULE_DATA, Map::class.java)?.let { schedules ->
            val currentTime = Date().time
            val cutoffTime = currentTime - (365L * 24 * 60 * 60 * 1000) // 365 days in milliseconds
            
            @Suppress("UNCHECKED_CAST")
            val filteredSchedules = (schedules as Map<String, Any>).filterValues { schedule ->
                val timestamp = (schedule as? Map<String, Any>)?.get("timestamp") as? Long
                timestamp != null && timestamp > cutoffTime
            }
            
            setObject(Keys.SCHEDULE_DATA, filteredSchedules, true)
        }

        // Update last cleanup timestamp
        setString(Keys.LAST_SYNC, Date().time.toString(), false)
    }
}