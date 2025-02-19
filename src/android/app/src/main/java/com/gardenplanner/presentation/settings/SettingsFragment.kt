package com.gardenplanner.presentation.settings

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.gardenplanner.R
import com.google.android.material.button.MaterialButton
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Fragment responsible for displaying and managing user settings with enhanced security features
 * including biometric authentication and secure storage of preferences.
 *
 * @version 1.0
 * @since 2024-01
 */
@AndroidEntryPoint
class SettingsFragment : Fragment() {

    private val viewModel: SettingsViewModel by viewModels()
    
    private lateinit var notificationSwitch: SwitchCompat
    private lateinit var biometricSwitch: SwitchCompat
    private lateinit var clearSettingsButton: MaterialButton

    // Permission request launcher for notifications
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            viewModel.setNotificationsEnabled(true)
            showFeedback("Notification permission granted")
        } else {
            notificationSwitch.isChecked = false
            showFeedback("Notification permission required for reminders")
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(R.layout.fragment_settings, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Initialize UI components
        notificationSwitch = view.findViewById(R.id.switch_notifications)
        biometricSwitch = view.findViewById(R.id.switch_biometric)
        clearSettingsButton = view.findViewById(R.id.button_clear_settings)

        setupObservers()
        setupClickListeners()
        checkNotificationPermission()
    }

    private fun setupObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Observe notifications state
            viewModel.notificationsEnabled.collectLatest { enabled ->
                notificationSwitch.isChecked = enabled
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe biometric state
            viewModel.biometricEnabled.collectLatest { enabled ->
                biometricSwitch.isChecked = enabled
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe session validity
            viewModel.sessionValid.collectLatest { valid ->
                if (!valid) {
                    // Lock UI elements if session is invalid
                    notificationSwitch.isEnabled = false
                    biometricSwitch.isEnabled = false
                    clearSettingsButton.isEnabled = false
                    showFeedback("Please authenticate to access settings")
                }
            }
        }
    }

    private fun setupClickListeners() {
        notificationSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked && !checkNotificationPermission()) {
                requestNotificationPermission()
                return@setOnCheckedChangeListener
            }
            
            viewModel.validateSession { isValid ->
                if (isValid) {
                    viewModel.setNotificationsEnabled(isChecked)
                } else {
                    notificationSwitch.isChecked = !isChecked
                    showFeedback("Authentication required to change settings")
                }
            }
        }

        biometricSwitch.setOnCheckedChangeListener { _, isChecked ->
            viewModel.validateSession { isValid ->
                if (isValid) {
                    viewModel.setBiometricEnabled(isChecked)
                } else {
                    biometricSwitch.isChecked = !isChecked
                    showFeedback("Authentication required to change settings")
                }
            }
        }

        clearSettingsButton.setOnClickListener {
            showClearSettingsConfirmation()
        }
    }

    private fun showClearSettingsConfirmation() {
        viewModel.validateSession { isValid ->
            if (isValid) {
                Snackbar.make(
                    requireView(),
                    "Are you sure you want to clear all settings?",
                    Snackbar.LENGTH_LONG
                ).setAction("Clear") {
                    viewModel.clearAllSettings()
                }.show()
            } else {
                showFeedback("Authentication required to clear settings")
            }
        }
    }

    private fun checkNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun showFeedback(message: String) {
        Snackbar.make(requireView(), message, Snackbar.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        super.onDestroy()
        // Cleanup any pending operations
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.clearAllSettings()
        }
    }
}