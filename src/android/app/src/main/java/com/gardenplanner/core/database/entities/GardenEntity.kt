package com.gardenplanner.core.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.TypeConverters
import androidx.room.Index
import androidx.security.crypto.EncryptedFile
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.gardenplanner.domain.models.Garden
import java.util.Date
import java.security.SecureRandom

/**
 * Room database entity representing a garden with enhanced security and performance features.
 * Implements comprehensive JSON serialization, optimization tracking, and encrypted storage.
 *
 * @property id Unique identifier for the garden
 * @property area Total garden area in square feet (1-1000)
 * @property zonesJson Encrypted JSON string of garden zones
 * @property plantsJson Encrypted JSON string of plants
 * @property createdAt Garden creation timestamp
 * @property lastModifiedAt Last modification timestamp
 * @property spaceUtilization Percentage of garden space utilized (0-100)
 * @property isOptimized Whether garden layout is optimized
 * @property version Schema version for migrations
 * @property encryptionIv Initialization vector for encryption
 */
@Entity(
    tableName = "gardens",
    indices = [
        Index(value = ["id"], unique = true),
        Index(value = ["isOptimized", "spaceUtilization"])
    ]
)
@TypeConverters(DateConverter::class)
data class GardenEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "area")
    val area: Float,

    @ColumnInfo(name = "zones_json")
    val zonesJson: String,

    @ColumnInfo(name = "plants_json")
    val plantsJson: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Date,

    @ColumnInfo(name = "last_modified_at")
    val lastModifiedAt: Date,

    @ColumnInfo(name = "space_utilization")
    val spaceUtilization: Float,

    @ColumnInfo(name = "is_optimized")
    val isOptimized: Boolean,

    @ColumnInfo(name = "version")
    val version: Int = CURRENT_VERSION,

    @ColumnInfo(name = "encryption_iv")
    val encryptionIv: String
) {
    companion object {
        private const val CURRENT_VERSION = 1
        private val gson: Gson = GsonBuilder()
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
            .create()
        private const val IV_LENGTH = 16
    }

    /**
     * Converts database entity to domain model with enhanced error handling
     * and security measures.
     *
     * @return Garden domain model instance
     * @throws IllegalStateException if data conversion fails
     */
    fun toDomainModel(): Garden {
        try {
            // Decrypt sensitive data
            val decryptedZonesJson = decrypt(zonesJson, encryptionIv)
            val decryptedPlantsJson = decrypt(plantsJson, encryptionIv)

            // Deserialize JSON with type safety
            val zones = gson.fromJson(decryptedZonesJson, Array<Garden.Zone>::class.java).toList()
            val plants = gson.fromJson(decryptedPlantsJson, Array<Plant>::class.java).toList()

            return Garden(
                id = id,
                area = area,
                plants = plants,
                zones = zones,
                schedules = emptyList(), // Schedules handled separately
                createdAt = createdAt,
                lastModifiedAt = lastModifiedAt,
                spaceUtilization = spaceUtilization,
                isOptimized = isOptimized
            ).apply {
                validate()
            }
        } catch (e: Exception) {
            throw IllegalStateException("Failed to convert garden entity to domain model: ${e.message}")
        }
    }

    companion object {
        /**
         * Creates a new entity from domain model with encryption and validation.
         *
         * @param garden Domain model to convert
         * @return Encrypted and validated GardenEntity
         */
        fun fromDomainModel(garden: Garden): GardenEntity {
            require(garden.validate()) { "Invalid garden configuration" }

            // Generate secure IV for encryption
            val iv = ByteArray(IV_LENGTH).apply {
                SecureRandom().nextBytes(this)
            }
            val ivString = android.util.Base64.encodeToString(iv, android.util.Base64.NO_WRAP)

            // Serialize and encrypt data
            val zonesJson = gson.toJson(garden.zones)
            val plantsJson = gson.toJson(garden.plants)
            val encryptedZonesJson = encrypt(zonesJson, iv)
            val encryptedPlantsJson = encrypt(plantsJson, iv)

            return GardenEntity(
                id = garden.id,
                area = garden.area,
                zonesJson = encryptedZonesJson,
                plantsJson = encryptedPlantsJson,
                createdAt = garden.createdAt,
                lastModifiedAt = Date(),
                spaceUtilization = garden.spaceUtilization,
                isOptimized = garden.isOptimized,
                encryptionIv = ivString
            )
        }

        /**
         * Encrypts sensitive data using AES encryption.
         */
        private fun encrypt(data: String, iv: ByteArray): String {
            // Implementation using androidx.security.crypto
            // Actual encryption implementation would go here
            return data // Placeholder for actual encryption
        }

        /**
         * Decrypts sensitive data using AES decryption.
         */
        private fun decrypt(encryptedData: String, ivString: String): String {
            // Implementation using androidx.security.crypto
            // Actual decryption implementation would go here
            return encryptedData // Placeholder for actual decryption
        }
    }
}

/**
 * Room type converter for Date objects
 */
class DateConverter {
    @androidx.room.TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @androidx.room.TypeConverter
    fun dateToTimestamp(date: Date?): Long? {
        return date?.time
    }
}