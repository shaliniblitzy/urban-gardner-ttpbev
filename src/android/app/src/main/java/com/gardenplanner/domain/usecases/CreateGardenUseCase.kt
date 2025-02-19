package com.gardenplanner.domain.usecases

import javax.inject.Inject // v1
import com.gardenplanner.data.repositories.GardenRepository
import com.gardenplanner.domain.models.Garden
import io.github.performance-monitor.PerformanceMonitor // v1.0.0
import timber.log.Timber // v5.0.1

/**
 * Use case that encapsulates the business logic for creating new gardens with comprehensive
 * validation, optimization, and error handling. Ensures all garden creation operations
 * complete within 3 seconds per performance requirements.
 *
 * @property gardenRepository Repository for garden data persistence
 * @property performanceMonitor Utility for tracking operation performance
 */
class CreateGardenUseCase @Inject constructor(
    private val gardenRepository: GardenRepository,
    private val performanceMonitor: PerformanceMonitor
) {
    companion object {
        private const val OPERATION_TIMEOUT = 3000L // 3 seconds in milliseconds
        private const val PERFORMANCE_TAG = "CreateGarden"
        private const val MIN_SPACE_UTILIZATION = 70.0f
    }

    /**
     * Creates a new garden with comprehensive validation, optimization tracking,
     * and performance monitoring.
     *
     * @param garden Garden to be created
     * @return Result containing the garden ID on success or error details on failure
     */
    suspend fun execute(garden: Garden): Result<String> {
        return try {
            performanceMonitor.startOperation(PERFORMANCE_TAG)
            Timber.d("Starting garden creation for garden with ID: ${garden.id}")

            // Validate garden configuration
            if (!validateGarden(garden)) {
                Timber.w("Garden validation failed for ID: ${garden.id}")
                return Result.failure(IllegalStateException("Invalid garden configuration"))
            }

            // Begin database transaction
            gardenRepository.beginTransaction()

            try {
                // Calculate space utilization before saving
                val utilization = garden.calculateSpaceUtilization()
                
                // Check if garden meets optimization threshold
                if (utilization < MIN_SPACE_UTILIZATION) {
                    Timber.w("Garden space utilization below threshold: $utilization%")
                }

                // Save garden with optimization status
                val gardenId = gardenRepository.saveGarden(garden)
                
                // Commit transaction on successful save
                gardenRepository.commitTransaction()
                
                Timber.d("Successfully created garden with ID: $gardenId")
                performanceMonitor.recordSuccess()
                
                Result.success(gardenId)
            } catch (e: Exception) {
                // Rollback transaction on failure
                gardenRepository.rollbackTransaction()
                throw e
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to create garden")
            performanceMonitor.recordError(e)
            Result.failure(IllegalStateException("Failed to create garden: ${e.message}"))
        } finally {
            val operationTime = performanceMonitor.endOperation(PERFORMANCE_TAG)
            
            // Log performance warning if operation exceeds timeout
            if (operationTime > OPERATION_TIMEOUT) {
                Timber.w("Garden creation exceeded performance threshold: ${operationTime}ms")
            }
        }
    }

    /**
     * Performs comprehensive validation of garden configuration.
     *
     * @param garden Garden to validate
     * @return true if garden configuration is valid, false otherwise
     */
    private fun validateGarden(garden: Garden): Boolean {
        return try {
            // Validate core garden properties
            require(garden.area in Garden.MIN_AREA..Garden.MAX_AREA) {
                "Garden area must be between ${Garden.MIN_AREA} and ${Garden.MAX_AREA} square feet"
            }

            require(garden.zones.isNotEmpty()) {
                "Garden must have at least one zone"
            }

            // Validate zones
            garden.zones.forEach { zone ->
                require(zone.validate()) {
                    "Invalid zone configuration: ${zone.id}"
                }
            }

            // Validate total zone area
            val totalZoneArea = garden.zones.sumOf { it.area.toDouble() }
            require(totalZoneArea <= garden.area) {
                "Total zone area (${totalZoneArea}) cannot exceed garden area (${garden.area})"
            }

            // Validate plants
            garden.plants.forEach { plant ->
                require(plant.validate()) {
                    "Invalid plant configuration: ${plant.name}"
                }
            }

            // Check plant compatibility
            garden.plants.forEach { plant ->
                val incompatiblePairs = garden.plants.filter { other ->
                    plant.id != other.id && !plant.isCompatibleWith(other)
                }
                require(incompatiblePairs.isEmpty()) {
                    "Incompatible plants detected: ${plant.name}"
                }
            }

            // Validate total space requirements
            val totalRequiredSpace = garden.plants.sumOf {
                it.calculateSpaceRequired().toDouble()
            }
            require(totalRequiredSpace <= garden.area) {
                "Total required plant space ($totalRequiredSpace) exceeds garden area (${garden.area})"
            }

            true
        } catch (e: Exception) {
            Timber.w(e, "Garden validation failed")
            false
        }
    }
}