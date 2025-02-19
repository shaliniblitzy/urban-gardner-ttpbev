package com.gardenplanner.presentation.settings

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gardenplanner.core.storage.PreferencesManager
import com.gardenplanner.core.notifications.NotificationManager
import com.gardenplanner.core.security.BiometricManager
import com.gardenplanner.core.utils.Constants.PREFERENCES.KEY_NOTIFICATIONS_ENABLED
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.Date

/**
 * ViewModel responsible for managing settings and preferences state with enhanced security
 * and validation in the Garden Planner application.
 *
 * @property preferencesManager Manages encrypted storage of user preferences
 * @property notificationManager Handles notification permissions and delivery
 * @property biometricManager Manages biometric authentication and session validation
 * @version 1.0
 * @since 2024-01
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val preferencesManager: PreferencesManager,
    private val notificationManager: NotificationManager,
    private val biometricManager: BiometricManager
) : ViewModel() {

    // Settings state management
    private val _settingsState = MutableLiveData<SettingsState>()
    val settingsState: LiveData<SettingsState> = _settingsState

    // Notification settings
    private val _notificationsEnabled = MutableLiveData<Boolean>()
    val notificationsEnabled: LiveData<Boolean> = _notificationsEnabled

    // Biometric authentication settings
    private val _biometricEnabled = MutableLiveData<Boolean>()
    val biometricEnabled: LiveData<Boolean> = _biometricEnabled

    // Last settings update timestamp
    private var lastSettingsUpdate: Long = 0

    init {
        loadSettings()
    }

    /**
     * Data class representing the current state of settings
     */
    data class SettingsState(
        val isLoading: Boolean = false,
        val error: String? = null,
        val lastSync: Long? = null
    )

    /**
     * Securely loads user settings from encrypted storage with session validation
     */
    private fun loadSettings() {
        viewModelScope.launch {
            try {
                _settingsState.value = SettingsState(isLoading = true)

                // Verify biometric session if enabled
                if (biometricManager.isSessionValid()) {
                    // Load notification preferences
                    preferencesManager.getObject(KEY_NOTIFICATIONS_ENABLED, Boolean::class.java, true)?.let {
                        _notificationsEnabled.value = it
                    }

                    // Load biometric settings
                    preferencesManager.getObject("biometric_enabled", Boolean::class.java, true)?.let {
                        _biometricEnabled.value = it
                    }

                    lastSettingsUpdate = Date().time
                    _settingsState.value = SettingsState(
                        isLoading = false,
                        lastSync = lastSettingsUpdate
                    )
                } else {
                    _settingsState.value = SettingsState(
                        isLoading = false,
                        error = "Authentication required to access settings"
                    )
                }
            } catch (e: Exception) {
                _settingsState.value = SettingsState(
                    isLoading = false,
                    error = "Failed to load settings: ${e.message}"
                )
            }
        }
    }

    /**
     * Updates notification settings with permission validation and secure storage
     *
     * @param enabled New notification enabled state
     */
    fun setNotificationsEnabled(enabled: Boolean) {
        viewModelScope.launch {
            try {
                _settingsState.value = SettingsState(isLoading = true)

                // Verify biometric authentication
                biometricManager.authenticateWithBiometrics { authenticated ->
                    if (authenticated) {
                        // Update notification settings
                        preferencesManager.setObject(KEY_NOTIFICATIONS_ENABLED, enabled, true)
                        _notificationsEnabled.value = enabled

                        // Create test notification to verify permissions
                        if (enabled) {
                            val testNotification = NotificationManager.NotificationData(
                                id = 0,
                                title = "Notifications Enabled",
                                message = "You will now receive garden maintenance reminders",
                                taskType = "SYSTEM",
                                importance = 3
                            )
                            notificationManager.showNotification(testNotification)
                        }

                        _settingsState.value = SettingsState(
                            isLoading = false,
                            lastSync = Date().time
                        )
                    } else {
                        _settingsState.value = SettingsState(
                            isLoading = false,
                            error = "Authentication required to change settings"
                        )
                    }
                }
            } catch (e: Exception) {
                _settingsState.value = SettingsState(
                    isLoading = false,
                    error = "Failed to update notification settings: ${e.message}"
                )
            }
        }
    }

    /**
     * Updates biometric authentication settings with hardware validation
     *
     * @param enabled New biometric enabled state
     */
    fun setBiometricEnabled(enabled: Boolean) {
        viewModelScope.launch {
            try {
                _settingsState.value = SettingsState(isLoading = true)

                // Check biometric hardware availability
                when (biometricManager.checkBiometricAvailability()) {
                    BiometricManager.BiometricStatus.AVAILABLE -> {
                        // Require authentication before changing biometric settings
                        biometricManager.authenticateWithBiometrics { authenticated ->
                            if (authenticated) {
                                preferencesManager.setObject("biometric_enabled", enabled, true)
                                _biometricEnabled.value = enabled
                                _settingsState.value = SettingsState(
                                    isLoading = false,
                                    lastSync = Date().time
                                )
                            } else {
                                _settingsState.value = SettingsState(
                                    isLoading = false,
                                    error = "Authentication failed"
                                )
                            }
                        }
                    }
                    else -> {
                        _settingsState.value = SettingsState(
                            isLoading = false,
                            error = "Biometric authentication not available on this device"
                        )
                    }
                }
            } catch (e: Exception) {
                _settingsState.value = SettingsState(
                    isLoading = false,
                    error = "Failed to update biometric settings: ${e.message}"
                )
            }
        }
    }

    /**
     * Securely resets all settings to default values with authentication
     */
    fun clearAllSettings() {
        viewModelScope.launch {
            try {
                _settingsState.value = SettingsState(isLoading = true)

                biometricManager.authenticateWithBiometrics { authenticated ->
                    if (authenticated) {
                        // Clear all settings
                        preferencesManager.clear()
                        
                        // Reset to defaults
                        _notificationsEnabled.value = false
                        _biometricEnabled.value = false
                        
                        _settingsState.value = SettingsState(
                            isLoading = false,
                            lastSync = Date().time
                        )
                    } else {
                        _settingsState.value = SettingsState(
                            isLoading = false,
                            error = "Authentication required to clear settings"
                        )
                    }
                }
            } catch (e: Exception) {
                _settingsState.value = SettingsState(
                    isLoading = false,
                    error = "Failed to clear settings: ${e.message}"
                )
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        // Ensure any pending operations are completed
        viewModelScope.launch {
            if (_settingsState.value?.isLoading == true) {
                _settingsState.value = SettingsState(
                    isLoading = false,
                    error = "Settings update interrupted"
                )
            }
        }
    }
}