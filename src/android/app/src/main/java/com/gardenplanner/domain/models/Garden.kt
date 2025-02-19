package com.gardenplanner.domain.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import java.util.Date

/**
 * Core domain model representing a garden with comprehensive space optimization
 * and maintenance management capabilities.
 *
 * @property id Unique identifier for the garden
 * @property area Total garden area in square feet (valid range: 1-1000)
 * @property plants List of plants in the garden
 * @property zones List of garden zones with distinct conditions
 * @property schedules List of maintenance schedules
 * @property createdAt Garden creation timestamp
 * @property lastModifiedAt Last modification timestamp
 * @property spaceUtilization Percentage of garden space utilized (0-100)
 * @property isOptimized Whether garden layout is optimized
 * @property zoneUtilization Map of zone IDs to their space utilization
 * @property plantCount Total number of plants
 * @property hasOverdueMaintenance Whether there are overdue maintenance tasks
 */
@Parcelize
data class Garden(
    val id: String,
    val area: Float,
    val plants: List<Plant>,
    val zones: List<Zone>,
    val schedules: List<Schedule>,
    val createdAt: Date,
    val lastModifiedAt: Date = Date(),
    var spaceUtilization: Float = 0f,
    var isOptimized: Boolean = false,
    var zoneUtilization: Map<String, Float> = emptyMap(),
    var plantCount: Int = plants.size,
    var hasOverdueMaintenance: Boolean = false
) : Parcelable {

    /**
     * Represents a garden zone with specific conditions
     */
    @Parcelize
    data class Zone(
        val id: String,
        val name: String,
        val area: Float,
        val sunlightHours: Int,
        val plants: List<String> = emptyList() // Plant IDs in this zone
    ) : Parcelable {
        fun validate(): Boolean = area > 0f && sunlightHours in 0..24
    }

    init {
        calculateSpaceUtilization()
        hasOverdueMaintenance = hasOverdueTasks()
        validate()
    }

    /**
     * Calculates detailed space utilization metrics for the entire garden and individual zones.
     *
     * @return Percentage of space utilized (0-100) with precision to 2 decimal places
     */
    fun calculateSpaceUtilization(): Float {
        var totalUsedSpace = 0f
        val zoneUtilizationMap = mutableMapOf<String, Float>()

        // Calculate zone-specific utilization
        zones.forEach { zone ->
            val zonePlants = plants.filter { plant ->
                zone.plants.contains(plant.id)
            }
            
            val zoneUsedSpace = zonePlants.sumOf { 
                it.calculateSpaceRequired().toDouble() 
            }.toFloat()

            val zoneUtilization = (zoneUsedSpace / zone.area * 100f)
                .coerceIn(0f, 100f)
            
            zoneUtilizationMap[zone.id] = zoneUtilization
            totalUsedSpace += zoneUsedSpace
        }

        // Update class properties
        zoneUtilization = zoneUtilizationMap
        spaceUtilization = (totalUsedSpace / area * 100f)
            .coerceIn(0f, 100f)
            .round(2)

        return spaceUtilization
    }

    /**
     * Performs comprehensive check of maintenance tasks with priority consideration.
     *
     * @return True if any high-priority schedule is overdue
     */
    fun hasOverdueTasks(): Boolean {
        val highPrioritySchedules = schedules.filter { 
            it.priority <= 2 // Priority 1 and 2 are considered high priority
        }
        
        hasOverdueMaintenance = highPrioritySchedules.any { it.isOverdue() }
        return hasOverdueMaintenance
    }

    /**
     * Performs comprehensive validation of garden configuration including
     * space, plant compatibility, and zone setup.
     *
     * @return True if garden configuration is valid and optimized
     * @throws IllegalStateException if validation fails
     */
    fun validate(): Boolean {
        // Validate garden area
        require(area in 1f..1000f) {
            "Garden area must be between 1 and 1000 square feet"
        }

        // Validate zones
        require(zones.isNotEmpty()) {
            "Garden must have at least one zone"
        }
        
        require(zones.all { it.validate() }) {
            "Invalid zone configuration"
        }

        // Validate total zone area doesn't exceed garden area
        val totalZoneArea = zones.sumOf { it.area.toDouble() }
        require(totalZoneArea <= area) {
            "Total zone area cannot exceed garden area"
        }

        // Validate plants
        require(plants.all { it.validate() }) {
            "Invalid plant configuration"
        }

        // Check plant compatibility
        plants.forEach { plant ->
            val incompatiblePairs = plants.filter { other ->
                plant.id != other.id && !plant.isCompatibleWith(other)
            }
            require(incompatiblePairs.isEmpty()) {
                "Incompatible plants detected: ${plant.name}"
            }
        }

        // Validate total plant space requirements
        val totalRequiredSpace = plants.sumOf {
            it.calculateSpaceRequired().toDouble()
        }
        require(totalRequiredSpace <= area) {
            "Total required plant space exceeds garden area"
        }

        // Validate schedules
        require(schedules.all { it.validate() }) {
            "Invalid schedule configuration"
        }

        return true
    }

    /**
     * Utility function to round float values to specified decimal places
     */
    private fun Float.round(decimals: Int): Float {
        var multiplier = 1.0f
        repeat(decimals) { multiplier *= 10 }
        return kotlin.math.round(this * multiplier) / multiplier
    }

    companion object {
        const val MIN_AREA = 1f
        const val MAX_AREA = 1000f
        const val MIN_ZONES = 1
    }
}