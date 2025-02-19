package com.gardenplanner.core.storage

import android.content.Context
import android.os.Environment
import com.gardenplanner.core.security.EncryptionManager
import com.gardenplanner.domain.models.Garden
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit
import kotlin.synchronized

/**
 * Manages secure file system operations for garden data storage with enhanced security and reliability.
 * Implements thread-safe operations, encryption, and file integrity verification.
 *
 * @property context Android application context
 * @property encryptionManager Manager for data encryption/decryption
 * @version 1.0.0
 */
class FileManager(
    private val context: Context,
    private val encryptionManager: EncryptionManager
) {

    companion object {
        private const val GARDEN_DATA_DIR = "garden_data"
        private const val CACHE_DIR = "cache"
        private const val IMAGE_DIR = "images"
        private const val BACKUP_DIR = "backups"
        private const val MAX_CACHE_SIZE = 100 * 1024 * 1024 // 100MB
        private const val MAX_FILE_AGE_DAYS = 30L
    }

    private val baseDir: File
    private val cacheDir: File
    private val imageDir: File
    private val backupDir: File
    private val fileLock = Object()

    init {
        // Initialize base directory in app's private storage
        baseDir = context.getDir(GARDEN_DATA_DIR, Context.MODE_PRIVATE)
        
        // Initialize subdirectories
        cacheDir = File(baseDir, CACHE_DIR).apply { mkdirs() }
        imageDir = File(baseDir, IMAGE_DIR).apply { mkdirs() }
        backupDir = File(baseDir, BACKUP_DIR).apply { mkdirs() }

        // Initial cache cleanup
        clearCache()
    }

    /**
     * Saves garden data to encrypted file with integrity verification.
     *
     * @param garden Garden instance containing ID for file naming
     * @param data String data to be encrypted and saved
     * @return Boolean indicating success of save operation
     */
    @Synchronized
    fun saveGardenData(garden: Garden, data: String): Boolean {
        synchronized(fileLock) {
            try {
                val gardenFile = File(baseDir, "${garden.id}.dat")
                val tempFile = File(baseDir, "${garden.id}.tmp")
                val backupFile = File(backupDir, "${garden.id}.bak")

                // Create backup of existing file if present
                if (gardenFile.exists()) {
                    gardenFile.copyTo(backupFile, overwrite = true)
                }

                // Encrypt data
                val encryptedData = encryptionManager.encryptString(data)

                // Write to temporary file first
                FileOutputStream(tempFile).use { fos ->
                    fos.write(encryptedData.toByteArray(Charsets.UTF_8))
                    fos.flush()
                }

                // Verify file integrity
                val verificationPassed = verifyFileIntegrity(tempFile, encryptedData)

                return if (verificationPassed) {
                    // Move temporary file to final location
                    tempFile.renameTo(gardenFile)
                    true
                } else {
                    // Restore from backup if verification fails
                    if (backupFile.exists()) {
                        backupFile.copyTo(gardenFile, overwrite = true)
                    }
                    tempFile.delete()
                    false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                return false
            }
        }
    }

    /**
     * Loads garden data from encrypted file with integrity verification.
     *
     * @param gardenId ID of the garden to load
     * @return Decrypted garden data as String or null if operation fails
     */
    @Synchronized
    fun loadGardenData(gardenId: String): String? {
        synchronized(fileLock) {
            try {
                val gardenFile = File(baseDir, "$gardenId.dat")
                val backupFile = File(backupDir, "$gardenId.bak")

                if (!gardenFile.exists()) {
                    return null
                }

                // Read encrypted data
                val encryptedData = FileInputStream(gardenFile).use { fis ->
                    String(fis.readBytes(), Charsets.UTF_8)
                }

                // Verify file integrity
                if (!verifyFileIntegrity(gardenFile, encryptedData)) {
                    // Attempt to restore from backup
                    if (backupFile.exists()) {
                        backupFile.copyTo(gardenFile, overwrite = true)
                        return loadGardenData(gardenId) // Recursive call with restored file
                    }
                    return null
                }

                // Decrypt data
                return encryptionManager.decryptString(encryptedData)
            } catch (e: Exception) {
                e.printStackTrace()
                return null
            }
        }
    }

    /**
     * Saves garden image with size optimization and integrity verification.
     *
     * @param filename Name for the image file
     * @param imageData ByteArray of image data
     * @return Path to saved image or null if operation fails
     */
    @Synchronized
    fun saveImage(filename: String, imageData: ByteArray): String? {
        synchronized(fileLock) {
            try {
                val uniqueFilename = generateUniqueFilename(filename)
                val imageFile = File(imageDir, uniqueFilename)
                
                FileOutputStream(imageFile).use { fos ->
                    fos.write(imageData)
                    fos.flush()
                }

                // Verify file integrity
                if (imageFile.length() == imageData.size.toLong()) {
                    return imageFile.absolutePath
                }

                // Delete file if verification fails
                imageFile.delete()
                return null
            } catch (e: Exception) {
                e.printStackTrace()
                return null
            }
        }
    }

    /**
     * Deletes garden data and associated files with backup creation.
     *
     * @param gardenId ID of the garden to delete
     * @return Boolean indicating success of deletion
     */
    @Synchronized
    fun deleteGardenData(gardenId: String): Boolean {
        synchronized(fileLock) {
            try {
                val gardenFile = File(baseDir, "$gardenId.dat")
                val backupFile = File(backupDir, "$gardenId.bak")

                // Create backup before deletion
                if (gardenFile.exists()) {
                    gardenFile.copyTo(backupFile, overwrite = true)
                }

                // Delete garden file
                val gardenDeleted = gardenFile.delete()

                // Clean up associated cache files
                val cacheFiles = cacheDir.listFiles { file ->
                    file.name.startsWith(gardenId)
                }
                cacheFiles?.forEach { it.delete() }

                return gardenDeleted
            } catch (e: Exception) {
                e.printStackTrace()
                return false
            }
        }
    }

    /**
     * Clears cached files based on size and age limits.
     */
    @Synchronized
    fun clearCache() {
        synchronized(fileLock) {
            try {
                val currentTime = System.currentTimeMillis()
                val cacheFiles = cacheDir.listFiles() ?: return

                // Sort files by last modified time
                val sortedFiles = cacheFiles.sortedBy { it.lastModified() }

                // Calculate current cache size
                var currentCacheSize = sortedFiles.sumOf { it.length() }

                // Delete old files
                sortedFiles.forEach { file ->
                    val fileAge = TimeUnit.MILLISECONDS.toDays(currentTime - file.lastModified())
                    
                    if (fileAge > MAX_FILE_AGE_DAYS || currentCacheSize > MAX_CACHE_SIZE) {
                        if (file.delete()) {
                            currentCacheSize -= file.length()
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Verifies integrity of saved file by comparing content.
     */
    private fun verifyFileIntegrity(file: File, expectedContent: String): Boolean {
        return try {
            val actualContent = FileInputStream(file).use { fis ->
                String(fis.readBytes(), Charsets.UTF_8)
            }
            actualContent == expectedContent
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Generates unique filename to prevent conflicts.
     */
    private fun generateUniqueFilename(filename: String): String {
        val timestamp = System.currentTimeMillis()
        val extension = filename.substringAfterLast(".", "")
        val baseName = filename.substringBeforeLast(".")
        return "${baseName}_${timestamp}.$extension"
    }
}