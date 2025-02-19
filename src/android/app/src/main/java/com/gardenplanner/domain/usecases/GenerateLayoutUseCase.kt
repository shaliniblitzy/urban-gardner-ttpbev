package com.gardenplanner.domain.usecases

import javax.inject.Inject // v1
import kotlinx.coroutines.flow.Flow // v1.7.0
import kotlinx.coroutines.flow.flowOf // v1.7.0
import kotlinx.coroutines.withContext // v1.7.0
import kotlinx.coroutines.Dispatchers // v1.7.0
import com.gardenplanner.data.repositories.GardenRepository
import com.gardenplanner.domain.models.Garden
import java.util.concurrent.ConcurrentHashMap
import kotlin.system.measureTimeMillis

/**
 * Use case that handles the generation of optimized garden layouts with enhanced
 * performance optimization and comprehensive error handling.
 *
 * Key features:
 * - Space optimization algorithm with < 3s response time
 * - Companion planting compatibility validation
 * - Sunlight zone optimization
 * - Performance monitoring and caching
 * - Comprehensive error handling
 */
class GenerateLayoutUseCase @Inject constructor(
    private val gardenRepository: GardenRepository
) {
    // Cache for optimized layouts with concurrent access support
    private val layoutCache = ConcurrentHashMap<String, CachedLayout>()

    // Performance monitoring thresholds
    companion object {
        private const val MAX_EXECUTION_TIME_MS = 3000 // 3 seconds max execution time
        private const val CACHE_VALIDITY_HOURS = 24L
        private const val MIN_SPACE_UTILIZATION = 70f // 70% minimum utilization
        private const val ACCESSIBILITY_BUFFER = 1.2f // 20% extra space for access
    }

    /**
     * Generates an optimized garden layout based on input parameters.
     * Implements caching and performance monitoring to ensure < 3s response time.
     *
     * @param garden Garden configuration to optimize
     * @return Flow emitting the optimized garden layout
     * @throws IllegalStateException if optimization fails or exceeds time limit
     */
    suspend fun execute(garden: Garden): Flow<Garden> = withContext(Dispatchers.Default) {
        try {
            // Check cache first
            getCachedLayout(garden.id)?.let {
                return@withContext flowOf(it.garden)
            }

            var optimizedGarden: Garden? = null
            val executionTime = measureTimeMillis {
                // Validate input parameters
                validateInput(garden)

                // Create optimized garden instance
                optimizedGarden = garden.copy(
                    isOptimized = false,
                    spaceUtilization = 0f
                )

                // Optimize zone divisions based on sunlight
                optimizedGarden = optimizeZones(optimizedGarden!!)

                // Optimize plant placement with companion planting rules
                optimizedGarden = optimizePlantPlacement(optimizedGarden!!)

                // Calculate final space utilization
                optimizedGarden!!.calculateSpaceUtilization()

                // Validate optimization results
                validateOptimizationResult(optimizedGarden!!)
            }

            // Verify performance requirements
            require(executionTime <= MAX_EXECUTION_TIME_MS) {
                "Layout generation exceeded time limit: $executionTime ms"
            }

            // Cache successful result
            optimizedGarden?.let { cacheLayout(it) }

            // Persist optimized garden
            optimizedGarden?.let {
                gardenRepository.saveGarden(it)
            }

            flowOf(optimizedGarden!!)
        } catch (e: Exception) {
            throw IllegalStateException("Failed to generate garden layout: ${e.message}")
        }
    }

    /**
     * Validates input garden parameters with comprehensive checks.
     *
     * @param garden Garden to validate
     * @throws IllegalArgumentException if validation fails
     */
    private fun validateInput(garden: Garden) {
        require(garden.area in 1f..1000f) {
            "Garden area must be between 1 and 1000 square feet"
        }
        require(garden.zones.isNotEmpty()) {
            "Garden must have at least one zone"
        }
        require(garden.plants.isNotEmpty()) {
            "Garden must have at least one plant"
        }

        // Validate total required space
        val totalRequiredSpace = garden.plants.sumOf {
            (it.calculateSpaceRequired() * ACCESSIBILITY_BUFFER).toDouble()
        }
        require(totalRequiredSpace <= garden.area) {
            "Total required plant space exceeds garden area"
        }

        // Validate zone configuration
        garden.zones.forEach { zone ->
            require(zone.validate()) {
                "Invalid zone configuration: ${zone.id}"
            }
        }
    }

    /**
     * Optimizes zone divisions based on sunlight requirements.
     *
     * @param garden Garden to optimize zones for
     * @return Garden with optimized zones
     */
    private fun optimizeZones(garden: Garden): Garden {
        val optimizedZones = garden.zones.map { zone ->
            // Group plants by sunlight requirements
            val zonePlants = garden.plants.filter { plant ->
                plant.sunlightHours <= zone.sunlightHours
            }

            // Calculate optimal zone area
            val zoneArea = zonePlants.sumOf {
                it.calculateSpaceRequired().toDouble()
            }.toFloat() * ACCESSIBILITY_BUFFER

            zone.copy(
                area = zoneArea.coerceAtMost(garden.area),
                plants = zonePlants.map { it.id }
            )
        }

        return garden.copy(zones = optimizedZones)
    }

    /**
     * Optimizes plant placement considering companion planting rules.
     *
     * @param garden Garden to optimize plant placement for
     * @return Garden with optimized plant placement
     */
    private fun optimizePlantPlacement(garden: Garden): Garden {
        val optimizedZones = garden.zones.map { zone ->
            val zonePlants = garden.plants.filter { plant ->
                zone.plants.contains(plant.id)
            }

            // Sort plants by compatibility score
            val sortedPlants = zonePlants.sortedByDescending { plant ->
                zonePlants.count { other ->
                    plant.id != other.id && plant.isCompatibleWith(other)
                }
            }

            zone.copy(plants = sortedPlants.map { it.id })
        }

        return garden.copy(
            zones = optimizedZones,
            isOptimized = true
        )
    }

    /**
     * Validates optimization results meet requirements.
     *
     * @param garden Optimized garden to validate
     * @throws IllegalStateException if optimization requirements not met
     */
    private fun validateOptimizationResult(garden: Garden) {
        require(garden.spaceUtilization >= MIN_SPACE_UTILIZATION) {
            "Space utilization below minimum threshold: ${garden.spaceUtilization}%"
        }

        // Verify zone allocation
        val totalZoneArea = garden.zones.sumOf { it.area.toDouble() }
        require(totalZoneArea <= garden.area) {
            "Total zone area exceeds garden area"
        }

        // Verify plant compatibility
        garden.zones.forEach { zone ->
            val zonePlants = garden.plants.filter { it.id in zone.plants }
            zonePlants.forEach { plant ->
                val incompatibleNeighbors = zonePlants.filter { other ->
                    plant.id != other.id && !plant.isCompatibleWith(other)
                }
                require(incompatibleNeighbors.isEmpty()) {
                    "Incompatible plants detected in zone ${zone.id}"
                }
            }
        }
    }

    /**
     * Retrieves cached layout if valid.
     *
     * @param gardenId Garden identifier
     * @return Cached layout if valid, null otherwise
     */
    private fun getCachedLayout(gardenId: String): CachedLayout? {
        return layoutCache[gardenId]?.takeIf { it.isValid() }
    }

    /**
     * Caches optimized garden layout.
     *
     * @param garden Optimized garden to cache
     */
    private fun cacheLayout(garden: Garden) {
        layoutCache[garden.id] = CachedLayout(
            garden = garden,
            timestamp = System.currentTimeMillis()
        )
    }

    /**
     * Clears the layout cache.
     */
    fun clearCache() {
        layoutCache.clear()
    }

    /**
     * Data class for cached layout with validity checking.
     */
    private data class CachedLayout(
        val garden: Garden,
        val timestamp: Long
    ) {
        fun isValid(): Boolean {
            val age = System.currentTimeMillis() - timestamp
            return age <= CACHE_VALIDITY_HOURS * 3600 * 1000
        }
    }
}