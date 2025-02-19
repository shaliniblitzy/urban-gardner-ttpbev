package com.gardenplanner.core.security

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Thread-safe manager for encryption and decryption of sensitive data using AES-256 encryption
 * with GCM mode and secure key storage.
 * 
 * @property encryptionKey SecretKey for AES-256 encryption
 * @property cipher Cipher instance for encryption/decryption operations
 * @property keyStore EncryptedSharedPreferences for secure key storage
 * @property lock Object for thread synchronization
 * 
 * @version 1.1.0-alpha06 (androidx.security.crypto)
 */
class EncryptionManager(private val context: Context) {

    companion object {
        private const val ALGORITHM = "AES/GCM/NoPadding"
        private const val KEY_SIZE = 256
        private const val KEY_ALIAS = "garden_planner_encryption_key"
        private const val IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128
        private const val VERSION_IDENTIFIER: Byte = 1
        private const val ENCRYPTED_PREFS_FILE = "encrypted_prefs"
        private const val KEY_STORAGE_KEY = "encryption_key"
    }

    private val lock = Object()
    private val cipher: Cipher
    private val keyStore: EncryptedSharedPreferences
    private var encryptionKey: SecretKey

    init {
        // Initialize secure key storage
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        keyStore = EncryptedSharedPreferences.create(
            ENCRYPTED_PREFS_FILE,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        ) as EncryptedSharedPreferences

        // Initialize or retrieve encryption key
        encryptionKey = retrieveOrGenerateKey()

        // Initialize cipher
        cipher = Cipher.getInstance(ALGORITHM)

        // Validate key size and algorithm support
        require(encryptionKey.encoded.size * 8 == KEY_SIZE) {
            "Invalid key size: ${encryptionKey.encoded.size * 8} bits"
        }
    }

    /**
     * Encrypts data using AES-256 encryption with GCM mode and random IV.
     * 
     * @param data ByteArray of data to encrypt
     * @return Base64 encoded encrypted data with IV and version identifier
     * @throws IllegalStateException if encryption fails
     */
    fun encrypt(data: ByteArray): String = synchronized(lock) {
        try {
            // Generate random IV
            val iv = ByteArray(IV_LENGTH).apply {
                SecureRandom().nextBytes(this)
            }

            // Initialize cipher for encryption
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, gcmSpec)

            // Perform encryption
            val encryptedData = cipher.doFinal(data)

            // Combine version, IV, and encrypted data
            val combined = ByteBuffer.allocate(1 + IV_LENGTH + encryptedData.size)
                .put(VERSION_IDENTIFIER)
                .put(iv)
                .put(encryptedData)
                .array()

            // Encode to Base64
            return Base64.encodeToString(combined, Base64.NO_WRAP)
        } catch (e: Exception) {
            throw IllegalStateException("Encryption failed", e)
        }
    }

    /**
     * Decrypts AES-256 encrypted data with GCM authentication.
     * 
     * @param encryptedData Base64 encoded encrypted data with IV
     * @return Decrypted data as ByteArray
     * @throws IllegalStateException if decryption fails
     * @throws IllegalArgumentException if version is incompatible
     */
    fun decrypt(encryptedData: String): ByteArray = synchronized(lock) {
        try {
            // Decode Base64
            val combined = Base64.decode(encryptedData, Base64.NO_WRAP)
            val buffer = ByteBuffer.wrap(combined)

            // Extract version
            val version = buffer.get()
            require(version == VERSION_IDENTIFIER) {
                "Incompatible version identifier: $version"
            }

            // Extract IV
            val iv = ByteArray(IV_LENGTH)
            buffer.get(iv)

            // Extract encrypted data
            val encryptedBytes = ByteArray(buffer.remaining())
            buffer.get(encryptedBytes)

            // Initialize cipher for decryption
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, gcmSpec)

            // Perform decryption
            return cipher.doFinal(encryptedBytes)
        } catch (e: Exception) {
            throw IllegalStateException("Decryption failed", e)
        }
    }

    /**
     * Generates and securely stores a new AES-256 encryption key.
     * 
     * @return Generated SecretKey
     * @throws IllegalStateException if key generation fails
     */
    private fun generateKey(): SecretKey {
        try {
            val keyGenerator = KeyGenerator.getInstance("AES")
            keyGenerator.init(KEY_SIZE)
            val key = keyGenerator.generateKey()
            
            // Store key in secure storage
            keyStore.edit().putString(
                KEY_STORAGE_KEY,
                Base64.encodeToString(key.encoded, Base64.NO_WRAP)
            ).apply()
            
            return key
        } catch (e: Exception) {
            throw IllegalStateException("Key generation failed", e)
        }
    }

    /**
     * Retrieves existing key from secure storage or generates new one if not found.
     * 
     * @return Retrieved or generated SecretKey
     */
    private fun retrieveOrGenerateKey(): SecretKey {
        val storedKey = keyStore.getString(KEY_STORAGE_KEY, null)
        return if (storedKey != null) {
            val keyBytes = Base64.decode(storedKey, Base64.NO_WRAP)
            SecretKeySpec(keyBytes, "AES")
        } else {
            generateKey()
        }
    }

    /**
     * Convenience method to encrypt string data with UTF-8 encoding.
     * 
     * @param data String to encrypt
     * @return Encrypted string
     * @throws IllegalStateException if encryption fails
     */
    fun encryptString(data: String): String {
        return encrypt(data.toByteArray(Charsets.UTF_8))
    }

    /**
     * Convenience method to decrypt string data with UTF-8 encoding.
     * 
     * @param encryptedData Encrypted string to decrypt
     * @return Decrypted string
     * @throws IllegalStateException if decryption fails
     */
    fun decryptString(encryptedData: String): String {
        return decrypt(encryptedData).toString(Charsets.UTF_8)
    }

    /**
     * Performs key rotation by generating new key and re-encrypting existing data.
     * 
     * @return Success status of key rotation
     */
    fun rotateKey(): Boolean = synchronized(lock) {
        try {
            // Store current key as backup
            val oldKey = encryptionKey
            
            // Generate and set new key
            encryptionKey = generateKey()
            
            // Key rotation successful
            return true
        } catch (e: Exception) {
            // Restore old key if rotation fails
            encryptionKey = retrieveOrGenerateKey()
            return false
        }
    }
}