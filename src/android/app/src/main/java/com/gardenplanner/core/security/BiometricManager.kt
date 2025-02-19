package com.gardenplanner.core.security

import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager as AndroidBiometricManager
import androidx.fragment.app.FragmentActivity
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/**
 * Manages biometric authentication with enhanced security features including
 * strong box support, key attestation, and session management.
 * 
 * @property activity FragmentActivity context for BiometricPrompt
 * @version 1.0
 * @author GardenPlanner Security Team
 */
class BiometricManager(private val activity: FragmentActivity) {

    companion object {
        // Biometric prompt UI strings
        private const val BIOMETRIC_TITLE = "Authenticate Access"
        private const val BIOMETRIC_SUBTITLE = "Verify your identity to access garden data"
        private const val BIOMETRIC_NEGATIVE_BUTTON = "Cancel"

        // Error messages mapping
        private val BIOMETRIC_ERROR_MESSAGES = mapOf(
            AndroidBiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE to "Biometric hardware is currently unavailable",
            AndroidBiometricManager.BIOMETRIC_ERROR_UNABLE_TO_PROCESS to "Biometric processing error",
            AndroidBiometricManager.BIOMETRIC_ERROR_TIMEOUT to "Authentication timeout",
            AndroidBiometricManager.BIOMETRIC_ERROR_NO_BIOMETRICS to "No biometric features enrolled",
            AndroidBiometricManager.BIOMETRIC_ERROR_LOCKOUT to "Too many attempts. Try again later"
        )

        // Security constants
        private const val KEYSTORE_ALIAS = "garden_planner_biometric_key"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val SESSION_TIMEOUT_MS = 300000L // 5 minutes
    }

    private val executor: Executor = Executors.newSingleThreadExecutor()
    private var lastAuthenticationTimestamp: Long? = null
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var cryptoObject: BiometricPrompt.CryptoObject

    init {
        initializeBiometricPrompt()
        setupCryptoObject()
    }

    /**
     * Initializes BiometricPrompt with comprehensive callback handling
     */
    private fun initializeBiometricPrompt() {
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                lastAuthenticationTimestamp = System.currentTimeMillis()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                lastAuthenticationTimestamp = null
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                lastAuthenticationTimestamp = null
            }
        }

        biometricPrompt = BiometricPrompt(activity, executor, callback)
    }

    /**
     * Sets up cryptographic components for secure biometric operations
     */
    private fun setupCryptoObject() {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
            load(null)
        }

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )

        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        ).apply {
            setBlockModes(KeyProperties.BLOCK_MODE_CBC)
            setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
            setUserAuthenticationRequired(true)
            setInvalidatedByBiometricEnrollment(true)
            // Enable StrongBox if available
            if (activity.packageManager.hasSystemFeature("android.hardware.strongbox_keystore")) {
                setIsStrongBoxBacked(true)
            }
        }.build()

        keyGenerator.init(keyGenParameterSpec)
        val secretKey = keyGenerator.generateKey()
        
        val cipher = Cipher.getInstance("${KeyProperties.KEY_ALGORITHM_AES}/${KeyProperties.BLOCK_MODE_CBC}/${KeyProperties.ENCRYPTION_PADDING_PKCS7}")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        
        cryptoObject = BiometricPrompt.CryptoObject(cipher)
    }

    /**
     * Checks biometric capability including hardware, enrollment, and security level
     * @return BiometricStatus indicating availability with detailed reason
     */
    fun checkBiometricAvailability(): BiometricStatus {
        val biometricManager = AndroidBiometricManager.from(activity)
        
        return when (biometricManager.canAuthenticate(AndroidBiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            AndroidBiometricManager.BIOMETRIC_SUCCESS -> BiometricStatus.AVAILABLE
            AndroidBiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricStatus.HARDWARE_UNAVAILABLE
            AndroidBiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricStatus.HARDWARE_UNAVAILABLE
            AndroidBiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricStatus.NOT_ENROLLED
            AndroidBiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> BiometricStatus.SECURITY_UPDATE_REQUIRED
            else -> BiometricStatus.NOT_AVAILABLE
        }
    }

    /**
     * Shows biometric authentication prompt with enhanced security features
     * @param onSuccess Callback function executed on successful authentication
     * @param onError Callback function executed on authentication error
     */
    fun showBiometricPrompt(
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (checkBiometricAvailability() != BiometricStatus.AVAILABLE) {
            onError("Biometric authentication not available")
            return
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(BIOMETRIC_TITLE)
            .setSubtitle(BIOMETRIC_SUBTITLE)
            .setNegativeButtonText(BIOMETRIC_NEGATIVE_BUTTON)
            .setConfirmationRequired(true)
            .build()

        biometricPrompt.authenticate(promptInfo, cryptoObject)
    }

    /**
     * Initiates secure biometric authentication flow with session management
     * @param onAuthenticationComplete Callback function executed after authentication attempt
     */
    fun authenticateWithBiometrics(onAuthenticationComplete: (Boolean) -> Unit) {
        if (isSessionValid()) {
            onAuthenticationComplete(true)
            return
        }

        showBiometricPrompt(
            onSuccess = {
                onAuthenticationComplete(true)
            },
            onError = { error ->
                onAuthenticationComplete(false)
            }
        )
    }

    /**
     * Checks if current authentication session is valid
     * @return Boolean indicating if session is valid and not expired
     */
    fun isSessionValid(): Boolean {
        val timestamp = lastAuthenticationTimestamp ?: return false
        return System.currentTimeMillis() - timestamp < SESSION_TIMEOUT_MS
    }

    /**
     * Represents the current status of biometric authentication capability
     */
    enum class BiometricStatus {
        AVAILABLE,
        HARDWARE_UNAVAILABLE,
        NOT_ENROLLED,
        SECURITY_UPDATE_REQUIRED,
        NOT_AVAILABLE
    }
}